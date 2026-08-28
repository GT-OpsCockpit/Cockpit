# Cockpit — Inventaire exhaustif du legacy (`suivi-chauffeur-twilio`)

> Document de référence figeant l'état du prototype legacy avant réécriture. Source : lecture intégrale de `server.js` (2736 lignes) et de tous les fichiers de `public/` (14 pages HTML/JS/CSS). Aucune modification n'a été apportée au legacy — ce document vit uniquement dans `cockpit-v2`.

## 0. Vue d'ensemble

App de dispatching pour une société de VTC/chauffeur privé. Stack : Node.js + Express (monolithe `server.js`), pas de base de données (tout en `Map` JS en mémoire — perdu au redémarrage), front en HTML statique + JS vanilla (`common.js`) + Luxon (CDN) pour les fuseaux horaires. Intégrations : Twilio (WhatsApp + SMS OTP), nodemailer (email), Nominatim (géocodage), tz-lookup, FlightStats (vérification de vol), open.er-api.com (taux de change).

Le README du projet le qualifie lui-même de **prototype**, jamais testé en conditions réelles d'exécution.

---

## 1. Modèles de données (tout en `Map` JS — perdu au redémarrage)

### `sessions` — `token -> { email, expiresAt }`
Token = `crypto.randomBytes(32).toString('hex')`.

### `pendingOtp` — `email(lowercase) -> { code, expiresAt, attempts }`
Code à 6 chiffres, expiration 5 min, 5 tentatives max.

### `companyInfo` (singleton)
Champs : `name, legalName, street1, zipCode, city, country, vatNbr, email, website, ownerSurname, ownerName, mobile, ownerEmail`. Tous requis ensemble pour sauvegarder (`PUT` rejette si un seul manque). `companyInfoSaved` (bool) verrouille l'édition après la première sauvegarde.

### `accessRecords` — `ref -> { ref, surname, name, mobile, email, role, active, createdAt, deactivatedAt }`
- `role` ∈ `Dispatch | Admin`.
- Champs requis : surname, name, mobile, email, role (tous trim non-vides).
- Soft-delete uniquement (pas d'endpoint DELETE).
- **Important** : cette table n'est en réalité qu'un annuaire — elle ne sert à aucune authentification/autorisation réelle. Il n'existe qu'un seul mécanisme de login/session, lié à `ADMIN_EMAIL`/`ADMIN_PASSWORD` (variables d'env), complètement indépendant de cette table.

### `clients` — comptes clients
Champs : `ref, name, clientType ('individual'|'company'|'event'), contactFirstName, contactLastName, company, acronym, refPoOther, address, postalCode, city, country, vatNumber, email, billing, pocName, pocPhone, pocEmail, eventCountry, eventArea, eventStartDate, eventEndDate, active, createdAt`.
- `name` = company (si présent) sinon nom complet du contact sinon `Account {ref}`.
- `pocPhone` toujours normalisé (chiffres uniquement).
- Champs événement (`eventCountry/eventArea/eventStartDate/eventEndDate`) forcés à `null` sauf `clientType==='event'`.
- Requis par type : Company → `company` ; Event → `company` (nom d'événement) + eventCountry+eventArea+eventStartDate+eventEndDate ; Individual → contactFirstName+contactLastName.

### `drivers` — chauffeurs/partenaires
Champs : `ref, country, firstName, lastName, name, phone, company, email, area (défaut 'Local'), eventsOnly, eventCountry, eventArea, eventRef, unavailability, active, createdAt`.
- `unavailability` : `null | {type:'off', date} | {type:'holidays'|'sick', startDate, endDate}`.
- Règles de validation :
  - `eventsOnly` vrai → company, firstName, lastName, email, phone TOUS requis + champs de liaison événement requis.
  - Pas de company → chauffeur interne : firstName, lastName, phone requis.
  - Company sans nom → société partenaire : email seul requis.
  - Company + nom → chauffeur partenaire : email ET phone requis.
- Dédup par téléphone : `POST /api/drivers` renvoie le chauffeur existant si le téléphone est déjà enregistré (pas de doublon).

### `vehicles` — types/catégories de véhicule
`ref -> { ref, name, maxPax, createdAt }`, seedé depuis `DEFAULT_VEHICLE_TYPES`. `name` doit être unique.

### `fleet` — véhicules physiques
Champs : `ref, category, regNbr, make, model, yob, fourWD ('Yes'/'No'), nbPax, color (défaut 'Metallic Black'), acr (≤6 car.), local (bool, défaut true), country, area, partnerCompany, driverRef, eventsOnly, eventCountry, eventArea, eventRef, unavailability, active, createdAt`.
- `unavailability` : `null | {type:'repair'|'service'|'bodywork', startDate, endDate}` — véhicules internes/locaux uniquement.
- `partnerCompany`/`driverRef` uniquement pertinents/modifiables si `local===false` ; forcés `null` si local.
- `regNbr` unique (insensible à la casse).

### `invoices` — factures
`ref -> { ref, clientRef, clientName, isEvent, refPo, periodStart, periodEnd, createdAt, tripRefs[], totalHT, totalTTC }`. Immuable une fois créée (pas de PUT/PATCH/DELETE — l'action "Corriger" est un placeholder UI, non implémentée côté serveur).

### `trips` — courses
Champs : `ref, country, area, timezone, pickupDate, pickupTime, pickupLocation, dropoffLocation, service, hours, instructions, clientRef, clientName, passengerName, pocName, pocPhone, pocEmail, tracking (bool), paxCount, vehicleType, fleetRegNbr, fleetRef, priceEur, partnerRate, driverRef, driverName, billing, lang, flightNumber, bufferTime, fboAddress, tailNbr, nameboard, nameboardFileName, nameboardFileData (base64), pickupIata, dropoffIata, subContractor, partnerRef, partnerName, steps {}, createdAt, dispatched (bool), invoiced (bool), assignmentCancelled, assignmentCancelledAt, cancellationFee`.

### Compteurs de séquence
- `invoiceSeq` (global, `INV{n}`).
- `clientSeqIndividual`, `clientSeqCompany`, `clientSeqEvent` (indépendants, jamais remis à zéro) → `CI{n}`, `CC{n}`, `CE{n}`.
- `driverRefCounters` (Map préfixe → dernier n°, pas de reset).
- `vehicleSeq`, `fleetSeq` (globaux) → `V{n}`, `F{n}`.
- `accessSeqByPrefix = {D:0, O:0}` (par rôle, zero-pad 3 chiffres).
- `bookingCounters` (Map `"clientRef|YY" -> seq`) et `releasedBookingSeqs` (Map `"clientRef|YY" -> [seq libérés]`).

---

## 2. Génération des références

### Course : `R-{clientRef}-{YY}-{seq}`
- `YY` = 2 derniers chiffres de l'année courante.
- Compteur par `clientRef|YY` — indépendant par client ET par année (reset naturel car la clé change chaque année).
- Réutilisation du plus petit n° libéré (`releasedBookingSeqs`) avant d'incrémenter le compteur.
- Libération : quand le compte client d'une course change, ou quand une course est supprimée via annulation gratuite.
- **Pas de garde-fou** sur un n° max de séquence (aucune erreur possible en pratique malgré un try/catch prévu autour).

### Client : `CI{n}` (individuel), `CC{n}` (société), `CE{n}` (événement) — compteurs monotones simples par type, jamais réutilisés, pas de reset annuel.

### Chauffeur : `D•{scope}•{n}`
- Interne (pas de company) → préfixe toujours `D•FR•INT`, quel que soit le pays réel.
- Externe/partenaire → `D•{PAYS}•{AA}•{CCC}` (PAYS = code pays en majuscules, AA = 2 premières lettres de l'area, CCC = 3 premières lettres de la company, accents supprimés).
- **Incohérence notée** : les commentaires du code donnent des exemples type `US-LO-UBE-001` (tirets, zero-pad) alors que le séparateur réellement utilisé est `•` (puce) sans zero-padding.
- La ref ne change jamais même si pays/area/company sont modifiés ensuite.

### Véhicule flotte : `F{n}` — compteur global monotone.
### Type de véhicule : `V{n}` — compteur global monotone.
### Facture : `INV{n}` — compteur global monotone, jamais réutilisé.
### Compte accès : `{D|O}-{seq:3 chiffres}` — préfixe selon rôle (`Admin`→O, sinon D), zero-pad 3 chiffres, compteurs indépendants par préfixe, ref fixée définitivement même si le rôle change ensuite.

---

## 3. Routes API

Légende : **[Auth]** = session requise (JSON 401), **[Page]** = session requise (redirect login), **[Public]** = pas d'auth.

### Auth
- `POST /api/auth/login` **[Public]** — `{email,password}` comparés à `ADMIN_EMAIL`/`ADMIN_PASSWORD` (comparaison à temps constant). Génère un OTP à 6 chiffres, l'envoie par email (nodemailer) si SMTP configuré, sinon le renvoie en clair dans la réponse JSON (`devCode`) + `console.warn` — **mode dev explicitement marqué "à ne jamais laisser en prod"**.
- `POST /api/auth/verify` **[Public]** — `{email,code}`. 400 si pas de code en attente/expiré, 429 si ≥5 tentatives, 401 si code faux. Succès → crée une session, cookie `session=...; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax` (**pas de flag `Secure`**).
- `POST /api/auth/verify-password` **[Auth]** — re-vérifie `ADMIN_PASSWORD`, utilisé côté client avant des actions sensibles (gate "mot de passe manager").
- `POST /api/auth/logout` **[Public]** — supprime la session.
- `POST /api/owner/verify-password` **[Auth]** — vérifie `OWNER_PASSWORD` (variable distincte d'`ADMIN_PASSWORD`) — protège la page Owner et l'édition des infos société.

### Infos société
- `GET/PUT /api/company-info` **[Auth]** — PUT exige tous les `COMPANY_INFO_FIELDS` non vides.

### Comptes accès
- `GET/POST/PUT /api/access[/:ref]` **[Auth]** — validation surname/name/mobile/email/role.
- `PATCH /api/access/:ref/deactivate` **[Auth]** — soft-delete (pas de réactivation possible, asymétrie avec clients/drivers/fleet).

### Pages protégées (redirect `/login.html`)
`/dispatcher.html`, `/clients.html`, `/drivers.html`, `/vehicles.html`, `/planning-chauffeur.html`, `/planning-vehicules.html`, `/events.html`, `/invoicing.html`, `/finance.html`, `/owner.html`. `GET /` redirige vers `/dispatcher.html`.

### Métadonnées
- `GET /api/meta` **[Auth]** — `{countries, vehicleTypes, billingOptions, fleetMakes, fleetModelsByMake, fleetMinYear, fleetMaxYear, majorCities, vehicleCompatibility, categoryModels, fleetColors, fleetDefaultColor}`.

### Lookups externes
- `GET /api/geocode-tz` **[Auth]** — Nominatim + tz-lookup, retourne tz/lat/lon/label/pays/aéroport/IATA.
- `GET /api/fbo-lookup` **[Auth]** — annuaire FBO aéroports (matching par mots-clés).
- `POST /api/flight-check` **[Auth]** — vérifie un n° de vol via FlightStats, tolérance ±90 min ; dégradé (`configured:false`) si creds absentes.
- `GET /api/geocode-search` **[Auth]** — type-ahead adresse (Nominatim + tz-lookup), min 2 caractères.
- `GET /api/poc-search` **[Auth]** — recherche POC (clients + historique courses), dédupliqué, insensible aux accents.
- `GET /api/fx-rate` **[Auth]** — taux de change vs EUR (open.er-api.com), cache 1x/jour.

### Clients / Chauffeurs / Véhicules / Flotte
CRUD complet `GET/POST/PUT/DELETE` + `PATCH .../active` **[Auth]** pour chacun. Chauffeurs : `PATCH /api/drivers/:ref/unavailability`. Flotte : `PATCH /api/fleet-vehicles/:ref/driver` (déliaison partenaire), `PATCH /api/fleet-vehicles/:ref/unavailability` (interdit si `local===false`).

**Validation création/édition flotte** (chaîne complète) : `local` dérivé du body ; si externe → country/area/partnerCompany requis ; `category` doit exister ; `regNbr` requis+unique ; `make` ∈ `FLEET_MAKES` ; `model` ∈ `FLEET_MODELS_BY_MAKE[make]` ; couple make/model doit aussi être dans `CATEGORY_MODELS[category]` si restreint ; `yob` entre `FLEET_MIN_YEAR` et `FLEET_MAX_YEAR` ; `fourWD` ∈ Yes/No ; `nbPax` 0–50 ; `color` ∈ palette ; `acr` ≤6 car.

### Courses (`trips`) — cœur métier
- `POST /api/trips` **[Auth]** : `passengerName`, `country/pickupDate/pickupTime/pickupLocation` requis ; `dropoffLocation` requis sauf `service==='ASD'` (alors `hours` requis, 2–48) ; `service==='SPEC'` → `instructions` requis ; `paxCount` ≤ `maxPax` du type de véhicule ; `fleetRegNbr` doit résoudre un véhicule existant + compatibilité catégorie ; **aucune création à la volée** de client/chauffeur depuis le formulaire course (doivent préexister) ; résolution POC en cascade (course → compte client) ; ref générée automatiquement sauf `ref` manuel fourni (409 si collision) ; `timezone` dérivé du pays.
- `GET /api/trips/:ref` **[Public]** — utilisé par les pages de suivi sans login. Effet de bord : si `?viewer=driver` et `steps.received` pas encore posé, le tamponne automatiquement (le chauffeur "reçoit" la course en ouvrant simplement le lien).
- `PUT /api/trips/:ref` **[Auth]** — mêmes validations. Si le client change : nouvelle ref générée, ancienne libérée. Si le chauffeur/partenaire assigné change : reset complet de `steps={}` et de `dispatched=false` (oblige à renvoyer). Notification WhatsApp "updated" **best-effort** (ne bloque jamais la sauvegarde même si Twilio échoue).
- `POST /api/trips/:ref/cancel-assignment` **[Auth]** — fee "Free"/absent → supprime la course + libère la ref ; fee non-nul → garde la course, retire le chauffeur, marque `assignmentCancelled`.
- `POST /api/trips/:ref/advance-step` **[Auth]** — popup dispatcher "Valider l'étape ?", parcourt `FULL_STEP_ORDER`. Bloqué si annulée ou sous-traitance verrouillée. **Contrairement au PUT, l'échec Twilio ici renvoie une vraie erreur 500** (l'étape n'est enregistrée que si le message part réellement).
- `POST /api/trips/:ref/notify` **[Public]** — utilisé par la page chauffeur sans login, steps limités à `STEP_ORDER` (accepted/enroute/arrived/onboard/dropped).
- `POST /api/trips/:ref/dispatch-driver` **[Auth]** — bouton "avion en papier", envoie un WhatsApp **au chauffeur/partenaire** (pas au POC) ; c'est ce qui fait vraiment passer "À envoyer" → "Envoyé".

### Facturation
- `GET /api/invoices` **[Auth]**.
- `POST /api/invoices` **[Auth]** — `{tripRefs[], clientRef|eventRef, periodStart?, periodEnd?}` ; filtre les courses déjà facturées/inexistantes (silencieusement, pas d'erreur sauf si le résultat est vide) ; `totalHT` **recalculé côté serveur** (ne fait jamais confiance au total envoyé par le front) ; `totalTTC = totalHT × 1.1` (TVA 10% codée en dur) ; marque chaque course incluse `invoiced=true` (irréversible, pas de "défacturation").

### Statique
`express.static('public')` enregistré en dernier, après toutes les routes protégées explicites.

---

## 4. Workflow de statut des courses

- **`STEP_ORDER`** (déclenchable par le chauffeur) : `accepted → enroute → arrived → onboard → dropped`.
- **`FULL_STEP_ORDER`** (pipeline complet) : `transmitted → received → accepted → enroute → arrived → onboard → dropped`.
  - `transmitted` : posé automatiquement au clic sur "dispatch-driver", ou immédiatement à la création si sous-traitance verrouillée (société sans chauffeur nommé).
  - `received` : posé automatiquement dès que le chauffeur ouvre son lien de suivi (`?viewer=driver`), sans bouton.
  - `accepted → dropped` : déclenchés manuellement par le chauffeur (page publique) ou par le dispatcher (popup "Valider l'étape ?").
- **Messages WhatsApp** (`MESSAGES`, anglais uniquement — le champ `lang` du trip est mort, jamais utilisé pour choisir une langue) : envoyés au POC pour chaque étape (sauf `driverDispatch`, envoyé au chauffeur/partenaire).
- **Toggle "Suivi Oui/Non"** (`trip.tracking`) : si `false`, les étapes sont quand même enregistrées (timestamp) mais **aucun WhatsApp n'est envoyé** — réponse `{skipped:true}`.
- **Sous-traitance verrouillée** (`subContractor===true && !partnerRef`) : bloque `advance-step` avec une erreur explicite ("reste à Envoyé") car il n'y a pas de téléphone chauffeur pour aller plus loin.
- **Réassignation** : changer le chauffeur/partenaire (y compris passer de "personne" à "quelqu'un") réinitialise systématiquement `steps={}`, lève `assignmentCancelled`, remet `dispatched=false`.

---

## 5. Authentification & sessions

- **Login** : email+mot de passe (comparaison à temps constant contre `ADMIN_EMAIL`/`ADMIN_PASSWORD`, un seul compte admin possible, pas de base multi-utilisateurs) → OTP 6 chiffres (5 min, 5 tentatives) → session.
- **OTP** livré par email (nodemailer/SMTP) si configuré, sinon renvoyé en clair (`devCode`) — mode dev à ne jamais laisser en prod.
- **Session** : token aléatoire 32 octets, durée 7 jours, stockée serveur (`Map`), cookie `HttpOnly + SameSite=Lax` **sans `Secure`**.
- **Page Owner** protégée par un second secret distinct (`OWNER_PASSWORD`), indépendant du login principal.
- **Gate "mot de passe manager"** (`/api/auth/verify-password`) : uniquement une vérification déclenchée côté client avant d'appeler l'action sensible — **pas un vrai contrôle d'autorisation serveur** sur l'endpoint de mutation lui-même.
- **`TWILIO_SMS_FROM` vestigial** : variable d'env présente mais jamais utilisée (l'OTP part par email, pas par SMS malgré le nom du projet "twilio").
- **`accessRecords` (Dispatch/Admin)** : annuaire informationnel uniquement, aucune authentification réelle ne repose dessus.

---

## 6. Catalogues / constantes

- **`DEFAULT_VEHICLE_TYPES`** : 12 entrées (Business, E-Business, Van, E-Van, First, Luxe, Excep., SUV, Sprinter, Coach 35, Coach 50, Lugg.) avec capacité pax par défaut.
- **`VEHICLE_COMPATIBILITY`** : catégorie de course → catégories de véhicule flotte compatibles.
- **`BILLING_OPTIONS`** : Central (`account`), Card (`card`), Cash (`cash`).
- **`COUNTRIES`** : ~190 entrées `{name, code, dial, tz, currency}`. Pays éclatés par ville/région (plusieurs fuseaux) : États-Unis (6 régions), Canada (2), Russie (4), Australie (2), Brésil (2) — tous les autres pays n'ont qu'un seul fuseau IANA (limitation documentée dans le code).
- **`FLEET_MAKES`** : Audi, Bentley, BMW, Mercedes-Benz, Porsche, Rolls Royce, Tesla, VW.
- **`FLEET_COLORS`** : 7 couleurs nommées + hex, défaut "Metallic Black".
- **`FLEET_MODELS_BY_MAKE`** / **`CATEGORY_MODELS`** : modèles par marque, et sous-ensemble autorisé par catégorie de course.
- **`FLEET_MIN_YEAR`/`MAX_YEAR`** : fenêtre glissante de 10 ans, recalculée à chaque démarrage serveur.
- **`MAJOR_CITIES`** : liste de suggestion (texte libre toujours accepté).
- **`AIRPORT_FBO_DIRECTORY`** : 4 entrées d'exemple seulement (Nice, Cannes-Mandelieu, Paris-Le Bourget, Genève) — explicitement non-exhaustif.
- **`MESSAGES`** : templates anglais uniquement.
- **`COMPANY_INFO_FIELDS`** : 13 champs requis ensemble pour la fiche société.

---

## 7. Intégrations externes

- **Twilio WhatsApp** : envoi via `messages.create({from, to:'whatsapp:+...', body})`. En sandbox/dev, texte libre ; en prod, Meta impose un template pré-approuvé (`contentSid`/`contentVariables`) — code commenté, **jamais implémenté**.
- **Nodemailer (SMTP)** : utilisé une seule fois, pour l'envoi de l'OTP de login. Aucun autre email n'est envoyé par l'app (pas d'email de confirmation de course, pas d'email de facture).
- **tz-lookup** : résolution lat/lon → fuseau IANA (offline).
- **Nominatim (OpenStreetMap)** : géocodage adresse (recherche + type-ahead), avec `User-Agent` obligatoire ; détecte les aéroports via le tag OSM `aeroway`.
- **FlightStats/Cirium** : vérification d'horaire de vol, tolérance ±90 min, dégradation propre si non configuré.
- **open.er-api.com** : taux de change, cache 1x/jour en mémoire.
- **Recherche POC** : purement interne, agrège comptes clients + historique des courses.

---

## 8. Facturation

- Facture créée manuellement par le dispatcher à partir d'un ensemble choisi de courses "en attente" — **pas de job automatique de fin de période**.
- `totalHT` recalculé serveur (jamais fait confiance au total du front) ; **TVA 10% forfaitaire codée en dur**, aucune différenciation par pays/client malgré `client.vatNumber` stocké mais inutilisé pour le calcul.
- `refPo` de la facture vient du champ `refPoOther` du compte client (pas d'un PO par course).
- Chaque course incluse est marquée `invoiced=true` de façon définitive (pas de "défacturation").
- **Aucune génération de PDF côté serveur** (le PDF est généré côté client en JS avec jsPDF) ; **aucune conformité légale de numérotation** (compteur en mémoire, remis à zéro au redémarrage → risque de collision de n° de facture).
- Bouton "Corriger" (📝) sur une facture existante : placeholder UI, aucun endpoint backend derrière.

---

## 9. Règles métier transverses

- **Pas de référence orpheline** : `clientRef`, `driverRef`/`partnerRef`, `fleetRegNbr` d'une course doivent tous résoudre une entité déjà existante — jamais de création à la volée depuis le formulaire course.
- **Unicité** : nom de type de véhicule, immatriculation flotte (insensible casse), dédup chauffeur par téléphone, collision de ref course manuelle → 409.
- **Capacité** : `paxCount` ≤ `maxPax` du type de véhicule choisi.
- **Contraintes par service** : `ASD` → heures (2–48) au lieu de destination ; `SPEC` → instructions obligatoires.
- **Compatibilité catégorie/flotte** : imposée à la fois à la création de course (`VEHICLE_COMPATIBILITY`) et à la création de véhicule flotte (`CATEGORY_MODELS`).
- **Local vs Externe (flotte)** : local = pas de pays/area/partenaire/chauffeur-réservation ; externe = ces champs requis ; seuls les véhicules locaux/internes peuvent avoir une indisponibilité "réparation".
- **Chauffeurs/véhicules liés à un événement** (`eventsOnly`) : doivent pointer vers un compte client de type "event" existant.
- **Normalisation téléphone** : ~~chiffres uniquement~~ → **E.164 strict** (`+33612345678`), appliqué partout (POC, chauffeur, client, utilisateur, société). La convention legacy retirait le `+`, si bien que `0612345678` et `33612345678` cohabitaient dans la même colonne et que `whatsapp:+0612345678` était injoignable pour tout numéro saisi sans indicatif. La v2 valide le format côté formulaire (`<PhoneInput>` n'émet que de l'E.164) et côté API (`@IsPhone`), les deux via `isValidPhone` de `@cockpit/shared`. Reprise des données existantes : voir `docs/phone-e164-migration.md`.
- **Soft-delete généralisé** : clients, chauffeurs, véhicules, comptes accès — tous réversibles (`active` bool), le hard DELETE existe encore mais n'est plus utilisé par l'UI (gardé pour compat, protégé par le mot de passe manager côté client).
- **Reset des étapes à la réaffectation** : tout changement de chauffeur/partenaire réinitialise `steps`, lève `assignmentCancelled`, remet `dispatched=false`.
- **Sous-traitance verrouillée** : société sans chauffeur nommé → statut figé à "Envoyé", `advance-step` bloqué explicitement.
- **Annulation** : fee "Free"/absent → suppression pure de la course ; fee non-nul → conservation (facturable) en état "🛑 Stop".
- **Erreurs** : toutes les validations renvoient `{error: 'message humain'}` — pas de codes d'erreur structurés, texte affiché tel quel côté dispatcher.

---

## 10. Pages front (public/*.html)

Architecture partagée : 11 des 14 pages incluent `common.js` (`initCommon()`), dupliquent la même barre "Nouvelle course" et la même nav. `login.html`, `chauffeur.html`, `dashboard.html` sont autonomes (pas de `common.js`). Le fetch global est patché pour rediriger vers `/login.html` sur toute 401.

### `login.html` — connexion (public)
Flux 2 étapes : `#password-form` (email+mdp → `POST /api/auth/login`, affiche `devCode` si mode dev) puis `#code-form` (code 6 chiffres → `POST /api/auth/verify`). Countdown 5 min mirroir de l'expiration serveur, recharge la page à zéro.

### `dispatcher.html` — "Bookings" (auth), page d'accueil
- **Barre "Nouvelle course"** (`#trip-form`, dupliquée sur dispatcher/clients/drivers/events) : Pays/Area (combobox), Date/Heure PU (+ équivalent Paris via Luxon), Service (TSF/ASD/SPEC), Nb heures (ASD), Véhicule, Nb pax (plafonné au max du véhicule), Client (combobox restreint aux comptes existants), Paiement, Nom passager ; ligne 2 : adresses PU/DO (recherche live `/api/geocode-search`, détection aéroport → popup infos vol), Info, POC (recherche `/api/poc-search`) ; ligne 3 : Chauffeur/Sous-traitant+Partenaire, Immatriculation (filtrée par compatibilité catégorie), tarifs (devise dérivée du pays + FX live + marge live), boutons Créer / Créer & Envoyer.
- Persistance de brouillon en `localStorage`, partagée entre les pages qui ont la barre.
- **Deux tableaux** : "Local" et "Farm out", avec filtres (recherche, période, client, chauffeur, passager, véhicule, service), cellules cliquables ouvrant des popups d'édition rapide, icônes d'action (édition complète, envoi, annulation avec mot de passe manager).
- Rafraîchissement toutes les 5s.

### `clients.html` — "Customers" (auth)
Formulaire compte client (Individual/Company/Events avec modale dédiée pour Events), logique conditionnelle stricte (Company vide = client individuel), tableau avec édition (mot de passe manager requis pour sauvegarder), désactivation réversible, suppression définitive protégée.

### `drivers.html` — "Drivers & Partners" (auth)
Formulaire avec règle de validation conditionnelle complexe (interne / société partenaire / chauffeur partenaire / lié à un événement), popup de liaison véhicule pour un nouveau partenaire, deux tableaux (Chauffeurs / Partenaires), popup indisponibilité (jour off / congés / arrêt maladie, type verrouillé une fois choisi).

### `vehicles.html` — "Vehicles" (auth)
Formulaire flotte (Catégorie→Marque→Modèle chaînés, Local/Externe bascule les champs requis, Nb pax auto-calculé), deux tableaux (Interne / Externe), popup indisponibilité (réparation/service/carrosserie, interne uniquement).

### `planning-chauffeur.html` / `planning-vehicules.html` — plannings (auth)
Vue Liste (même format que Bookings) + vue Timeline (Gantt drag&drop, un rang par chauffeur/véhicule, blocs colorés par catégorie, pile de courses non assignées, contrôle de compatibilité catégorie sur le drop pour les véhicules).

### `events.html` — "Events" (auth)
Sélection/création d'un compte événement, barre de course identique + bouton "Create bulk" (génère une course par jour sur la plage de l'événement, enchaînement dropoff→pickup jour suivant, dernier jour forcé en ASD), recherche dédiée, liste unique.

### `invoicing.html` — "Invoicing" (auth)
Onglets Customer (recherche + panneau En attente + panneau Facturé, export Excel/PDF client-side), Driver log / History (placeholders "Coming soon"), Partner log (recherche + tableau générique).

### `finance.html` — "Finance" (auth)
Stub vide ("Coming soon"), aucune logique.

### `owner.html` — "Owner" (auth + second mot de passe distinct)
Panneau "Company" (13 champs, verrouillage après 1ère sauvegarde), panneau "Access" (création/édition/désactivation des comptes dispatcher/admin, admin protégé par re-saisie du mot de passe).

### `chauffeur.html` — lien chauffeur (public, `?ref=...`)
Page mobile : 2 étapes auto (transmitted/received, affichées en lecture seule) + 5 boutons d'action → `POST /api/trips/:ref/notify`. Bannière si suivi désactivé (pas de WhatsApp envoyé).

### `dashboard.html` — lien client/équipe (public, `?ref=...`)
Lecture seule, **rafraîchissement auto toutes les 5s**, 4 étapes affichées (pas "enroute"), moins de détail opérationnel que la page chauffeur (pas de POC/instructions).

### `common.js` — utilitaires partagés
Patch global de `fetch` (redirection sur 401), popups génériques (`openRecordModal`, `openConfirmDialog`, `openPasswordGateModal`), comboboxes (pays/client/chauffeur/adresse/POC/area), popup infos vol, popups indisponibilité chauffeur/véhicule, moteur de timeline Gantt partagé, helpers FX/devise, normalisation téléphone/affichage, persistance de brouillon.

### `style.css` — design system
Palette verte "WhatsApp" (`--green:#128C7E`), **thème clair uniquement**, branding "Cockpit" (logo + wordmark) sur chaque page, cartes/panneaux à ombre douce, badges de statut colorés par étape, surlignage de ligne par urgence (H-6/H-3/H-1) et par annulation/inactivité.

---

## 11. Dette technique / manques connus (synthèse — à traiter dans la réécriture)

- **Stockage 100% en mémoire** : toutes les données (courses, clients, chauffeurs, flotte, factures, comptes, sessions, compteurs de séquence) sont perdues à chaque redémarrage — risque de collision de références après coup.
- **Un seul compte admin** (email/mdp en variables d'env) — pas de vraie gestion multi-utilisateurs malgré la table `accessRecords`, qui n'est qu'un annuaire décoratif.
- **Cookie de session sans flag `Secure`** — à durcir en HTTPS-only.
- **Mode dev OTP en clair** : si SMTP non configuré, le code de vérification est renvoyé dans la réponse JSON — explicitement marqué "à ne jamais laisser en prod" dans le code lui-même.
- **`TWILIO_SMS_FROM` vestigial**, jamais utilisé (l'OTP part par email) — incohérence à nettoyer.
- **Gate "mot de passe manager"** : vérification déclenchée côté client uniquement, pas un vrai contrôle serveur sur l'endpoint de mutation lui-même.
- **Templates WhatsApp production non implémentés** : sandbox = texte libre, prod nécessite des templates Meta pré-approuvés — code commenté, jamais branché.
- **TVA forfaitaire 10% codée en dur**, aucune différenciation par pays/client, `client.vatNumber` stocké mais inutilisé.
- **Pas de génération de facture "propre"** : pas de PDF serveur, pas d'endpoint de correction de facture (placeholder UI seulement).
- **Fuseaux horaires simplifiés** : un seul fuseau IANA par pays sauf 8 pays éclatés par ville/région.
- **Incohérence de format** dans les refs chauffeurs (commentaires vs implémentation réelle).
- **Champ `lang` mort** sur les courses (communication anglais uniquement, intention i18n abandonnée).
- **Aucun test automatisé, aucune CI**, aucune persistance/migration de schéma — le projet est qualifié de "prototype" par son propre README.

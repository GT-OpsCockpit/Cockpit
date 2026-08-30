# Écarts legacy → v2 — relevé du 2026-08-30

Compagnon du rapport QA `2026-08-30-qa-sweep.md`. Celui-ci ne parle pas de ce qui marche : il
liste, page par page, **ce que le legacy fait et que v2 ne fait pas**, ou fait autrement.

Méthode (§4 du prompt) : chaque page v2 exercée est immédiatement suivie de l'ouverture de son
équivalent legacy sur `localhost:4100`, d'un inventaire écrit du legacy, et d'un croisement dans
les deux sens. Les données legacy étant en mémoire (`trips`/`clients` sont des `Map`,
`server.js:343-344`), l'écran legacy démarre vide : l'état créé à la main pour faire apparaître les
contrôles conditionnels est indiqué pour chaque page.

Convention : un écart déjà tranché dans `docs/LEGACY_PARITY_AUDIT.md` (§15 fait foi) est signalé
comme **revu, non touché**.

## `/login` ↔ `/login.html`

Legacy comparé : `http://localhost:4100/login.html` (+ `server.js:126-210`).
État de données nécessaire : aucun (le compte admin vient du `.env` legacy).

**Inventaire legacy** : étape 1 — champ `Login` (`type=text`, `required`), champ `Password`
(`required`), bouton `Continue`, bandeau d'erreur. Étape 2 — champ `6-digit code`
(`inputmode=numeric`, `maxlength=6`, `required`), bandeau dev-code, compte à rebours
« Code still valid for m:ss » (rouge sous 1 min), bouton `Log in`, bandeau d'erreur.

**Aucune feature legacy sans équivalent v2.** Les écarts relevés sont tous dans le sens v2 ⊃ legacy
ou déjà tranchés :

| Écart | Legacy | v2 | Verdict |
|---|---|---|---|
| Format du login | champ texte libre, aucune validation de format côté client | `type=email` + message « Enter a valid email address. » | v2 plus strict — le legacy comparait de toute façon à `ADMIN_EMAIL`. Pas un manque. |
| Expiration du code | à 0:00 la page **se recharge toute seule** (`login.html:startCodeCountdown`) | champ + bouton désactivés, message « This code has expired. Go back and sign in again. » | équivalent fonctionnel, v2 moins brutal. Pas un manque. |
| Révéler le mot de passe | absent | bouton « Show password » | ajout v2. |
| Retour à l'étape 1 | absent (il faut recharger) | bouton « Back » | ajout v2. **Nuance** : `Back` vide les champs email/mot de passe, il faut tout retaper. Cosmétique, non corrigé. |
| Compte utilisateur | **un seul** compte partagé (`ADMIN_EMAIL`/`ADMIN_PASSWORD` du `.env`) | vrais comptes en base, rôles `ADMIN`/`DISPATCHER` | écart de conception déjà acté (`docs/agents/permissions.md`). **Revu, non touché.** |

**Écart de règle** : le legacy tolère 5 tentatives d'OTP puis **supprime le code** (429 + « please
log in again »), v2 tolère 5 tentatives puis renvoie 429 **en gardant le code** jusqu'à son
expiration (`auth.service.ts:100-107`). Sans conséquence exploitable (le code reste invérifiable
puisque tout `verify` suivant est refusé par le même garde). Noté, non corrigé.

**Bilan `/login` : aucune feature legacy manquante.**

## `/bookings` ↔ `/dispatcher.html`

Legacy comparé : `http://localhost:4100/dispatcher.html` (+ `public/common.js:3095-3116`,
`public/dispatcher.html:198-262`, `public/common.js:4287-4370`).
État de données créé à la main : 1 compte client (`CI1`, Marc Dubois) et **2 courses** — une locale
(area Nice → table *Local*, colonne Reg Nbr présente) et une non locale (area Paris → table
*Farm out*) — sans quoi les deux tables restent vides et aucune action de ligne n'est observable.

**Inventaire legacy — barre « New booking »** : Country (req.), Area, Date (req.), PU 🕐 (req.),
Service, Nb H, Vehicle (req.), Pax nb (req.), Customer (req.), Payment (req.), Pax Name (req.),
PU (req.), DO (req.), Info, POC Name, POC Mobile, Driver, Reg Nbr, Sub-C, Partner, Retail net,
Partner rate net, `Create`, `Create & Dispatch` ; plus 9 champs cachés alimentés par la popup
« Flight info » (flightNumber, bufferTime, fboAddress, tailNbr, nameboard, nameboardFileName,
nameboardFileData, pickupIata, dropoffIata).

**Inventaire legacy — barre de filtres** : search, period, client, driver, passenger, vehicle,
service. **Identique à v2**, au bouton « Reset filters » près (ajout v2).

**Inventaire legacy — tables** : colonnes identiques à v2 dans les deux tables (*Local* porte
`Reg Nbr`, *Farm out* non). Par ligne : 6 **cellules cliquables** (compte, passager/infos, véhicule,
Reg Nbr, Sub-C, chauffeur), le badge de statut cliquable, et 3 boutons (Edit ✏️, dispatch 📤,
Cancel ❌).

### Features legacy sans équivalent v2

| Feature | Ce qu'elle fait | Où elle vit | Pourquoi pas d'équivalent | Effort | Recommandation |
|---|---|---|---|---|---|
| **Popups d'édition rapide sur 6 cellules** | Modifier compte / passager+POC / véhicule / Reg Nbr / Sub-C / chauffeur sans ouvrir le formulaire complet | `common.js:2568-2940`, câblées en `onclick` sur les `td` (`common.js:3108-3113`) | **Tranché** : §15 de l'audit, « non portées ; leur seule règle métier (`isBeforeArrival`) l'est » | — | **Revu, non touché** |
| **Tooltip POC sous le nom du passager** | Au survol de la ligne, affiche `POC: <nom> · <téléphone international>` dès que le POC diffère du passager — le dispatcher voit qui appeler sur place **sans ouvrir quoi que ce soit** | `common.js:3108` (`<span class="field-tooltip">`) | **Oubli.** L'audit ne couvre que les *popups* de ces cellules (§6.6.2), pas l'affichage du POC, qui est passé à la trappe avec elles. v2 n'affiche le POC nulle part sur le tableau | **Faible** — un `title` (ou un `<Tooltip>` shadcn) sur la ligne passager de `bookings-table.tsx`, les données sont déjà dans `trip.pocName` / `trip.pocPhone` | **À porter.** C'est la seule info de la ligne qu'on ne peut plus obtenir qu'en ouvrant le dialogue d'édition, alors qu'elle sert précisément dans l'urgence |
| **Résumé « Flight info » cliquable** | Une ligne de rappel sous la barre (`Vol AF1234 · Buffer 20min · FBO …`) qui rouvre la popup | `dispatcher.html:109`, `common.js:1773-1800` | **Sans objet en v2** : les champs sont rendus *inline* dans le dialogue, il n'y a pas de popup à résumer ni à rouvrir | — | Sans objet |
| **Icône 📤 dans le badge de statut** | Le badge « Send ? » est préfixé d'une icône | `common.js:2443` | Cosmétique | — | Sans objet |

### Écarts de règle sur des contrôles présents des deux côtés

| Contrôle | Legacy | v2 | Verdict |
|---|---|---|---|
| **Champ `Area`** | **non requis** dans la barre ; le serveur retombe sur `'Local'` (`server.js:543`, `2201`) | **requis** par le formulaire ; le serveur retombe aussi sur `'Local'` (`booking-fields.ts:230`) | **Durcissement v2, non documenté jusqu'ici.** Conservé : `area` alimente le split Local/Farm out *et* l'éligibilité chauffeur — la valeur par défaut legacy était largement inerte (`'Local'` n'est pas dans `LOCAL_AREA_NAMES`, donc une course « Local » hors Nice/Cannes/St-Tropez basculait quand même en Farm out). Même nature que le durcissement « tarif partenaire » acté le 2026-08-29. **Signalé, pas corrigé** |
| **Case `Tracking`** | retirée de la barre, forcée à `yes` (`common.js:4300-4303`) | case exposée, cochée par défaut | Ajout v2 (on peut créer une course sans notifications). Pas un manque |
| **Nameboard** | fichier uniquement, dans la popup Flight info | champ **texte** inline + upload de fichier depuis la ligne | v2 ⊃ legacy (le champ texte a été porté par la passe du 2026-08-28) |
| **`Buffer (min)`** | `step="5"` (`common.js:1570`) | pas de `step` | Cosmétique. Non corrigé |
| **Recherche** | ref / compte / passager / chauffeur | identique, même placeholder | Aucun écart |
| **Bouton « Reset filters »** | absent | présent | Ajout v2 |
| **Colonne Itinéraire** | `shortPlaceLabel` préfixe la ville du fuseau | identique — vérifié en live des deux côtés : le legacy affiche lui aussi « Paris, CDG → Paris, Hotel Le Meurice » | Aucun écart. Confirme le §15 (« Deux tightenings assumés ») : **le comportement décrit comme legacy l'est bien** |

### Corrigés au passage sur cette page

Aucun des bugs corrigés sur `/bookings` (voir le rapport QA, `d04d366` et `2791109`) n'était un écart
*avec le legacy* : ce sont des défauts propres à v2. Le seul point où le legacy a servi de référence
est le rappel de capacité véhicule, rétabli avec **sa** formulation (`common.js:4329`), et le libellé
du frais d'annulation, rétabli au format du legacy (`common.js:3114`).

## `/clients` ↔ `/clients.html`

Legacy comparé : `http://localhost:4100/clients.html` (+ `public/common.js:3349-3440`,
`public/clients.html:200-260` et `:490-520`).
État de données créé à la main : 1 compte individuel (`CI1`), sans quoi la table affiche
« No accounts yet. » et aucune action de ligne n'est observable.

**Inventaire legacy — table** : REF | COUNTRY | ACRONYM | CUSTOMER | POC | POC PHONE |
INVOICE RECIPIENT | ACTION. Une seule action par ligne : ✏️ *Edit*. Aucune barre de filtres,
aucune recherche, aucune pagination — la liste est rendue en entier.

**Inventaire legacy — formulaire de création** (inline sur la page, pas un dialogue) : Type,
POC Surname, POC Name, Company, Acronym, Payment, Ref/PO/Other, Address, Zip Code, City, Country,
VAT Nbr, Invoice recipient, POC Full Name, POC Mobile, POC Email, `Create` ; plus 4 champs cachés
pour les comptes Events (eventCountry, eventArea, eventStartDate, eventEndDate).

### Features legacy sans équivalent v2

| Feature | Ce qu'elle fait | Où elle vit | Pourquoi pas d'équivalent | Effort | Recommandation |
|---|---|---|---|---|---|
| **Colonne COUNTRY** (avec drapeau) | Le pays du compte, en clair, dans la liste — `FR 🇫🇷` | `common.js:3369` | **Oubli.** v2 a remplacé les colonnes par Ref/Name/Type/Email/POC phone/Billing : le pays n'apparaît plus **nulle part** dans la liste, seulement dans le dialogue d'édition | **Faible** — une colonne, la donnée est déjà dans la réponse (`countryCode`) | **À porter.** C'est la seule info de facturation/localisation qu'on ne peut plus lire sans ouvrir chaque fiche |
| **Colonne POC** (nom du contact) | Le nom du contact sur place, à côté de son téléphone | `common.js:3372` | **Oubli.** v2 garde « POC phone » mais a perdu le nom qui va avec — on voit un numéro sans savoir à qui il est | **Faible** — une colonne, `pocName` est déjà renvoyé | **À porter.** Même remarque que le tooltip POC de `/bookings` : c'est l'information qu'on cherche dans l'urgence |
| **Dates de l'événement sur la ligne** | Pour un compte Events : `Events: <nom> (<début> → <fin>)` en gris sous le nom | `common.js:3358-3360` | **Oubli.** v2 affiche « Events » dans la colonne Type mais jamais les dates | **Faible** | À porter avec les deux précédentes, même cellule |
| **Acronyme : validation live** | Champ surligné orange et bouton `Create` **désactivé** avec l'infobulle « Acronym must be 4 letters max » | `clients.html:500-508` | **Écart d'UX assumé ici** : v2 affiche le message au submit. Jusqu'à cette passe v2 n'affichait *rien* (bug #7 du rapport QA) ; c'est désormais réparé | — | Sans objet — la règle est portée, sa restitution diffère |
| **Auto-synchro « POC Full Name »** | Le POC se remplit tout seul depuis Prénom + Nom tant qu'on n'y a pas touché (`pocNameAutoSynced`) | `clients.html:470-498` | v2 le fait **côté serveur** (`pocName` retombe sur le nom du contact, audit §3.7) mais pas en direct dans le formulaire | Faible | Sans objet — le résultat enregistré est le même |

### Écarts de règle sur des contrôles présents des deux côtés

| Contrôle | Legacy | v2 | Verdict |
|---|---|---|---|
| Libellés du contact | « POC Surname » / « POC Name » pour `contactFirstName` / `contactLastName` | « First name » / « Last name » | v2 plus clair, mêmes colonnes. Aucun écart métier |
| « Invoice recipient » | libellé du champ email de facturation | « Email » | Cosmétique |
| Désactivation | dans la popup d'édition (`deleteLabel: 'Deactivate Client'`) | bouton sur la ligne | Équivalent, plus direct |
| Suppression définitive | popup d'édition, derrière le mot de passe Manager | dialogue d'édition, derrière `record:delete` | Porté (§15) — **revu, non touché** |
| Tri | actifs puis `ref` | actifs puis `createdAt` | **Écart assumé** (§15) — **revu, non touché** |

### Ajouts v2 sans équivalent legacy

Recherche plein texte, filtre par Type, case « Show deactivated », **pagination serveur**, bouton
« New booking » pré-remplissant le compte, et réactivation depuis la ligne. Le legacy chargeait et
affichait la totalité des comptes d'un bloc.

**Bilan `/clients` : 3 features legacy manquantes**, toutes de l'affichage de liste (Country, POC,
dates d'événement), toutes de faible effort, toutes recommandées au portage.

## `/drivers` ↔ `/drivers.html`

Legacy comparé : `http://localhost:4100/drivers.html` (+ `server.js:478-560`,
`public/common.js:3498-3556`, `public/drivers.html:199-290`).
État de données créé à la main : **2 chauffeurs** — un interne (`D•FR•INT•1`, FR/Nice) et une
société partenaire (`D•FR•PA•LEG•1`, FR/Paris) — sans quoi les deux tableaux restent vides.

**Inventaire legacy — tableau Drivers** : REF | Country (+ drapeau) | Area | Company (« In-house ») |
Surname | Name | Mobile | Action.
**Tableau Partners** : les mêmes, **plus Email**.
Par ligne : 🫥 (Day off / Holidays), ✏️ Edit, ❌ Deactivate. L'indisponibilité et le badge
d'inactivité s'affichent en sous-ligne sous le nom, pas en colonne.

**Inventaire legacy — formulaire** : Country (**requis**), Area, Company, « Ind. » (désactivée),
Email (désactivée tant qu'aucune société), Surname (requis), Name (requis), Mobile (requis),
« Events » + 3 champs cachés de rattachement.

### Features legacy sans équivalent v2

| Feature | Ce qu'elle fait | Où elle vit | Pourquoi pas d'équivalent | Effort | Recommandation |
|---|---|---|---|---|---|
| **Colonne Country** (+ drapeau) | Le pays du chauffeur dans la liste | `common.js:3531` / `:3550` | **Oubli** — même angle mort que sur `/clients` : v2 a redéfini les colonnes et le pays n'est plus lisible qu'en ouvrant la fiche | Faible | **À porter**, avec celle de `/clients` |
| **Colonne Company** | « In-house » pour un interne, la société pour un partenaire | `common.js:3531` | Partiellement porté : v2 met la société entre parenthèses dans la cellule Nom (`(Uber Elite London)`), mais un interne n'affiche rien là où le legacy écrivait « In-house » | Très faible | À trancher — l'information existe, sa présentation diffère |
| **Colonnes Surname / Name séparées** | Deux colonnes triables | `drivers.html:274-279` | v2 fusionne en une colonne Name | — | Sans objet (v2 ne trie sur aucune colonne) |

### Écarts de règle sur des contrôles présents des deux côtés

| Contrôle | Legacy | v2 | Verdict |
|---|---|---|---|
| **Country sur le formulaire** | `required` sur `#d-country-input` (`drivers.html`) — impossible de créer un chauffeur sans pays | `countryCode: z.string().optional()` — **vérifié en live** : `D-XX-XX-QAP-001` a été créé sans pays ni area | **Validation perdue, à trancher par Romain.** Même famille que les quatre « validations perdues » restaurées le 2026-08-29 (`24107ea`). Non appliquée ici parce qu'elle a des conséquences sur les données : plusieurs chauffeurs de la base de dev ont `countryCode: null` et deviendraient inéditables tant qu'un pays ne leur est pas donné. Le serveur legacy ne l'exigeait pas non plus (`validateDriverFields` ne teste pas le pays) — c'était une contrainte de formulaire seule |
| **Format de la référence** | `D•FR•INT•1` — séparateur **puce** `•`, séquence **non paddée** (`nextDriverRef`, `server.js:531-535`) | `D-FR-INT-003` — tiret, séquence sur 3 chiffres | **Écart réel, jamais consigné.** À noter : le commentaire du legacy lui-même décrit « FR-INT-001, FR-INT-002… US-LO-UBE-001 » (`server.js:511-515`) — **le code et son propre commentaire divergent**, et v2 a implémenté le commentaire. **Recommandation : ne rien changer** — la logique de préfixe est identique (mêmes `letters()`, même découpe pays, 2 lettres d'area, 3 de société), l'écart est cosmétique, et l'aligner imposerait une migration de toutes les refs existantes pour un caractère plus difficile à taper et à rechercher |
| **Indisponibilité** | plage complète, « Day off » / « Sickness leave » | idem depuis `c39d6ce` (**corrigé pendant cette passe**) | Écart supprimé |
| **Emplacement de l'indisponibilité** | sous-ligne rouge sous le nom + icône 🫥 colorée quand elle est en vigueur | colonne dédiée | Présentation, pas de perte d'information |
| **Réactivation** | derrière le mot de passe Manager (`common.js:3596`) | derrière `driver:reactivate` (ADMIN) | Porté (§15) — **revu, non touché** |
| **Tri** | actifs puis `ref` | actifs puis `createdAt` | **Écart assumé** (§15) — **revu, non touché** |
| **Titres des tableaux** | « Drivers » / « Partners » | étaient « Chauffeurs » / « Partenaires » ; corrigés (`c39d6ce`) | Écart supprimé |

### Ajouts v2 sans équivalent legacy

Recherche, « Show deactivated », pagination serveur, bouton « New booking » pré-remplissant le
chauffeur ou le partenaire, colonne Email sur les deux tableaux, et le **cadenas de déliaison
véhicule↔chauffeur** (porté depuis la fiche Vehicles du legacy, cf. handoff du 2026-08-27).

**Bilan `/drivers` : 1 feature legacy manquante** (colonne Country), **1 validation perdue à
trancher** (Country requis), **1 écart de format de référence documenté et volontairement conservé**.

## `/vehicles` ↔ `/vehicles.html`

Legacy comparé : `http://localhost:4100/vehicles.html` (+ `public/vehicles.html:240-260`, `:380-395`,
`:488-530`, `:620-645`).
État de données créé à la main : **2 véhicules** (un interne, un externe) — sans quoi les deux
tableaux affichent « No … vehicles yet. » et aucune action de ligne n'est observable.

**Inventaire legacy — tableaux** : colonnes **identiques à v2**, dans le même ordre, pour les deux
tableaux (*Fleet - Internal* et *Fleet - External*, mêmes intitulés qu'en v2). Par ligne :
🔧 (Repair shop / Manufacturer service / Bodywork, **véhicules internes seulement**), ✏️ Edit
(**désactivé sur un véhicule retiré**, infobulle « Reactivate this vehicle to edit it »),
❌ « Remove from fleet ».

**Inventaire legacy — formulaire** : Category (requis), Local, Reg Nbr (requis), Acr. (requis),
Make (requis), Model (requis), Year (requis), Color (requis), 4WD, Nb Pax (`readonly`),
Country / Area / Partner (désactivés tant que « Local » est coché), Events + 3 champs cachés.
**Un pour un avec le dialogue v2.**

### Features legacy sans équivalent v2

**Aucune.** C'est la page la plus fidèlement portée de la passe : colonnes, ordre, intitulés des
deux tableaux, champs du formulaire, cascade Category→Make→Model, `defaultFleetPax`, réservation de
l'indisponibilité aux véhicules internes, crayon grisé sur un véhicule retiré, et la ligne du
chauffeur réservé sous le Reg Nbr (`linkedDriverLine`, `vehicles.html:499-505`) — tout est là et a
été vérifié à l'écran.

Point vérifié explicitement parce qu'il ressemblait à un manque : après avoir délié un véhicule de
son chauffeur (cadenas de `/drivers`), **aucune UI ne permet de le relier** — ni en v2, ni dans le
legacy. Le modal d'édition legacy n'a pas de champ chauffeur non plus (`vehicles.html:628-641`) ;
le lien ne se pose que par le raccourci « Ind. » à la création d'un partenaire, des deux côtés.
Le commentaire du legacy affirme pourtant le contraire (« *or the vehicle is edited to point at a
different chauffeur* », `vehicles.html:497-498`) — **son commentaire décrit une fonctionnalité que
son code n'a pas**. Aucun écart : v2 reproduit le comportement réel.

### Écarts de règle sur des contrôles présents des deux côtés

| Contrôle | Legacy | v2 | Verdict |
|---|---|---|---|
| Libellé de la désactivation | « Remove from fleet » | « Deactivate » | Cosmétique, aligné sur Clients/Drivers en v2 |
| `Nb Pax` | `readonly` | `disabled` | Équivalent à l'écran ; sans effet ici, la valeur passe par l'état du formulaire, pas par une soumission native |
| Réactivation | mot de passe Manager | `vehicle:reactivate` (ADMIN) | Porté (§15) — **revu, non touché** |
| Tri | actifs puis `ref` | actifs puis `createdAt` | **Écart assumé** (§15) — **revu, non touché** |

### Ajouts v2 sans équivalent legacy

Recherche, « Show deactivated », pagination serveur, bouton « New booking » pré-remplissant le
véhicule. Le legacy n'avait **aucun filtre** sur cette page.

**Bilan `/vehicles` : aucun écart.**

## `/planning` ↔ `/planning-chauffeur.html` **et** `/planning-vehicules.html`

Les deux pages legacy ont été ouvertes, comme le demande le §4 (deux écrans legacy pour un seul
écran v2). État de données : les 2 courses créées pour la comparaison `/bookings`.

**Inventaire legacy — `planning-chauffeur.html`** : bascule Daily / Event / All, `select` Period,
`select` Driver, bascule List / Timeline ; en vue Timeline un `input[type=date]` et une bascule
1 / 2 / 3 days. Tableau : `Pickup, REF, Cust / Pax, Itinerary, Vehicle, Reg Nbr, Sub-C, Driver,
Status, Action`. Trois actions par ligne : ✏️, 📤, ❌.

**`planning-vehicules.html`** : strictement la même page, avec `#pv-vehicle` à la place de
`#pc-driver`.

### Features legacy sans équivalent v2

**Aucune.** v2 fusionne les deux pages legacy derrière une bascule Drivers / Vehicles — choix de
conception documenté (journal du 2026-08-27), pas une perte : les deux jeux de couloirs, les deux
sélecteurs et les deux vues sont accessibles.

Le moteur de Gantt est porté fidèlement, y compris ce qui ne se voit pas à l'écran : les courses non
assignées ne sont **jamais** dessinées sur la grille mais listées comme cartes déplaçables dans la
pile (`common.js:2089-2094`, `:2240-2248`), les blocs assignés sont déplaçables pour désassigner
(`:2184`), et la règle `canDrop` refuse un couloir incompatible côté client.

### Écarts de règle sur des contrôles présents des deux côtés

| Contrôle | Legacy | v2 | Verdict |
|---|---|---|---|
| Actions de ligne | 3 (✏️ 📤 ❌) | 4 — ajout du bouton nameboard | Ajout v2, cohérent avec `/bookings` |
| Rafraîchissement | polling 5 s (« Auto-refreshes every 5 seconds ») | SSE (`/api/events/stream`) | Modernisation actée (§ audit 🔵) — **revue, non touchée** |
| Indicateur « maintenant » sur le Gantt | absent | ligne rouge + point | Ajout v2 assumé (journal du 2026-08-27) |
| Notification POC au drag & drop | le legacy passait par le `PUT` complet et notifiait le POC | `PATCH /assign` ne notifie pas | **Écart connu et listé** (audit §11.4 / §6.6.1) — **revu, non touché** |

**Bilan `/planning` : aucun écart nouveau.** Le seul point ouvert (la notification POC au drag &
drop) était déjà consigné.

## `/events` ↔ `/events.html`

Legacy comparé : `http://localhost:4100/events.html` (+ `public/common.js:3905-3960`,
`public/clients.html:520-535`).
État de données : les comptes Events de la base de dev v2 côté v2 ; côté legacy, la page a été
ouverte avec le compte client créé pour `/clients` (le legacy n'avait pas de compte Events, ce qui
suffit à inventorier les contrôles — le panneau « Select event » et la barre de recherche sont
rendus indépendamment des données).

**Inventaire legacy** : panneau « Select event » (`select` Client, champs Event et Dates en lecture
seule, boutons Cancel / New / Confirm) — **identique à v2** ; barre « New booking » avec `Create` et
**`Create bulk`** ; bloc « Search » : Client, Country, Date start, Date end, Vehicle type,
Event name, Ref/PO/Other — **identique à v2** ; « Ride list » aux mêmes colonnes que Bookings, avec
✏️ 📤 ❌ par ligne.

### Features legacy sans équivalent v2

| Feature | Ce qu'elle fait | Où elle vit | Pourquoi pas d'équivalent | Effort | Recommandation |
|---|---|---|---|---|---|
| **`offerEventReactivation`** | Après création d'un compte Events, propose de **relier au nouvel événement** les chauffeurs et véhicules `eventsOnly` déjà configurés pour le même **pays + area** lors d'un événement précédent et aujourd'hui dormants — cases à cocher, « Skip » / « Reactivate selected » | `common.js:3905-3980`, déclenchée depuis `clients.html:532` | **Tranché** : listée 🟡 en §4.4 de l'audit, non portée | Moyen (une popup, un filtre sur `eventsOnly` + `eventCountry`/`eventArea` + fenêtre d'événement écoulée, et un `PATCH` par enregistrement retenu) | **Revu, non touché.** Reste la feature legacy manquante la plus coûteuse à laisser tomber : sans elle, un événement récurrent impose de re-saisir toute son équipe |

### Écarts de règle sur des contrôles présents des deux côtés

| Contrôle | Legacy | v2 | Verdict |
|---|---|---|---|
| Flux « New » | **deux popups chaînées** (compte Events puis rattachement) | **un seul dialogue** réutilisant `ClientFormFields` verrouillé sur Events | Écart d'UX **délibéré et documenté** (journal du 2026-08-27) ; champs et validations identiques |
| Libellé du filtre | « Ref/PO/Other » | « Ref/PO » | Cosmétique |
| Actions de ligne | 3 (✏️ 📤 ❌) | 4 — ajout du nameboard | Ajout v2 |
| « Create bulk » | présent | présent, même règle de chaînage | Aucun écart (couvert par `bulk-create.ts` et son e2e) |

**Bilan `/events` : 1 feature legacy manquante** (`offerEventReactivation`), **déjà tranchée** dans
l'audit et laissée en l'état, comme le prompt le demande.

## `/invoicing` ↔ `/invoicing.html`

Legacy comparé : `http://localhost:4100/invoicing.html` (+ `public/invoicing.html:38-44`,
`:132-134`, `:180-184`, `:220-233`, `:279-300`).

**Inventaire legacy** : quatre onglets Customer / Driver log / Partner log / History ;
onglet Customer avec `select` Client, Date in, Date out, Ref/PO, Passenger, case **Events**, bouton
**Search**, puis « Pending » (Export to Excel + 🧾 Invoice) et « Invoiced » (Export to Excel).
**Driver log et History sont littéralement `<div class="empty">Coming soon.</div>`** — v2 les rend à
l'identique.

### Features legacy sans équivalent v2

**Aucune.**

### Écarts de règle sur des contrôles présents des deux côtés

| Contrôle | Legacy | v2 | Verdict |
|---|---|---|---|
| Déclenchement de la recherche | bouton **Search** explicite | filtrage réactif à la frappe | Ajout v2, rien de perdu |
| Période par défaut | mois précédent, étendu au mois de la plus ancienne course non facturée (`invoicing.html:220-233`) | **règle identique**, calculée côté serveur (`invoicingDefaultPeriod`) | Aucun écart. **Le commentaire HTML du legacy dit « defaults to the current calendar month » — son propre code dit le mois précédent.** Deuxième cas de cette passe où un commentaire legacy contredit son code ; v2 a suivi le code |
| Mode Events sans événement choisi | ne restreint pas au type Events | idem | Aucun écart |
| Chargement des courses | la page téléchargeait **toutes** les courses jamais enregistrées pour calculer sa période | un seul `findFirst` côté serveur | Modernisation, comportement identique |
| Bornes de facturation | classement sur la date murale du PU | instant ramené à minuit Paris | **Écart assumé** (§15) — **revu, non touché** |
| « Correct » | `alert('to be specified next')` | toast « the correction workflow is not defined yet. » | Aucun écart — non spécifié des deux côtés |

**Bilan `/invoicing` : aucun écart.**


## `/finance` ↔ `/finance.html`

Legacy comparé : `http://localhost:4100/finance.html` (+ `public/finance.html:33-36`).
État de données : aucun — la page n'en lit aucune.

**Inventaire legacy** : la barre de navigation, un titre `Finance`, et
`<div class="empty">Coming soon.</div>`. Rien d'autre : aucun champ, aucun bouton, aucun appel réseau.

### Features legacy sans équivalent v2

**Aucune.** v2 rend exactement la même chose — titre `Finance` + « Coming soon. » — et le lien de
nav porte bien l'état actif.

### Écarts de règle sur des contrôles présents des deux côtés

Aucun contrôle des deux côtés. Le seul écart de la page est celui de la **barre de navigation**,
commun à tous les écrans, relevé ici une fois pour toutes :

| Lien legacy | Lien v2 | Verdict |
|---|---|---|
| Bookings | Bookings | — |
| **Customers** | **Clients** | Cosmétique |
| **Drivers & Partners** | **Drivers** | Cosmétique — les deux tableaux sont bien là |
| Vehicles | Vehicles | — |
| **Drivers planning** + **Vehicles planning** (2 liens) | **Planning** (1 lien + bascule) | Fusion actée (journal du 2026-08-27) — **revue, non touchée** |
| Events / Invoicing / Finance | idem | — |
| **Owner** | **Settings** | Cosmétique ; le contenu est comparé ci-dessous |

**Bilan `/finance` : aucun écart.**

## `/settings` ↔ `/owner.html`

Legacy comparé : `http://localhost:4100/owner.html`, **ouvert en contexte isolé** et déverrouillé
avec `OWNER_PASSWORD` (+ `public/owner.html:33-165`, `:299-311`, `:340-410`,
`server.js:251-290`, `:788-801`).
État de données : le compte admin du `.env` legacy ; la table Access démarre vide
(« No access created yet »), les libellés de colonnes et le formulaire de création sont rendus
indépendamment des données, la ligne et ses deux actions ont été lues dans `owner.html:350-364`.

**Inventaire legacy** : la page entière est derrière une **porte mot de passe** (panneau
« 🔒 This page is password-protected. » + bouton `Enter password`, popup ouverte automatiquement au
chargement, vérifiée par `POST /api/owner/verify-password`). Une fois ouverte : panneau **Company**
(Name, Legal Name, Street, Zip Code, City, Country, VAT Nbr, Email, Website, Owner surname, Owner
name, Mobile, Owner email address + `Save`, puis ✏️ / ✅ une fois enregistrée) et panneau **Access**
(formulaire *inline* Surname, Name, Mobile, Email, Role[`Dispatch`|`Admin`] + `Create` ; table
REF / SURNAME / NAME / MOBILE / EMAIL / ROLE / ACTIVATED / ACTION avec ✏️ et ❌ par ligne, grisés
sur un compte désactivé).

### Features legacy sans équivalent v2

| Feature | Ce qu'elle fait | Où elle vit | Pourquoi pas d'équivalent | Effort | Recommandation |
|---|---|---|---|---|---|
| **Référence lisible du compte d'accès** | `createAccess` attribue `O-001`, `O-002`… à un Admin et `D-001`, `D-002`… à un Dispatch — la colonne REF donne le rôle et le rang d'un coup d'œil, et se cite au téléphone | `server.js:788-801`, colonne rendue en `owner.html:353` | **Oubli.** v2 n'a pas de colonne `ref` sur `User` : la colonne « Ref » de l'onglet Users affiche `user.id.slice(0, 8)` (`users-table.tsx:49`), soit les 8 premiers caractères d'un cuid — `cmtanuan`, `cmtb9fzc`. Illisible, non citable, et sans rapport avec le rôle | **Moyen** — une colonne `ref` sur `User`, un compteur par préfixe (le mécanisme existe déjà : `RefCounter` + `TripRefService`), une migration donnant une ref aux 6 comptes en place | **À trancher par Romain.** Aucune perte fonctionnelle — rien dans v2 ne s'adresse à un utilisateur par sa ref — mais la colonne telle qu'elle est n'apporte rien à personne : soit on lui donne une vraie ref, soit on retire la colonne |
| **Porte mot de passe Owner sur la page** | Toute la page reste masquée tant que `OWNER_PASSWORD` n'est pas saisi, à chaque visite | `owner.html:299-311` | **Tranché** : audit §1.2 🟠 — « toutes les portes mot de passe Manager/Owner deviennent des permissions de rôle », `company:edit` et `user:manage` | — | **Revu, non touché** |
| **❌ « Delete » sur un compte d'accès** | Confirmation + porte mot de passe, puis… `PATCH /api/access/:ref/deactivate` | `owner.html:400-407`, `server.js:284-290` | **Sans objet** : le bouton s'appelle « Delete » mais ne fait qu'une désactivation douce. v2 expose la même opération sous son vrai nom, « Deactivate » | — | Sans objet — v2 est plus honnête que le legacy |

### Écarts de règle sur des contrôles présents des deux côtés

| Contrôle | Legacy | v2 | Verdict |
|---|---|---|---|
| Mise en page | deux panneaux empilés sur une page | deux **onglets** Company / Users | Présentation. Aucun contrôle perdu |
| Champs Company | 13 champs | **les mêmes 13**, `VAT Nbr`→`VAT number`, ordre Email/Website inversé | Cosmétique |
| Édition de la fiche société | ✏️ + mot de passe Owner, rouvrable indéfiniment | bouton « Edit company info » + `company:edit`, rouvrable indéfiniment | Porté (§15, **B3 corrigé**) — **revu, non touché** |
| Création d'un compte | formulaire **inline** sous le titre Access | **dialogue** « New user » | Présentation |
| Champs du compte | Surname, Name, Mobile, Email, Role | idem **+ `Password` requis (min 8)** | **Écart assumé** (audit §1.5 🟠) — **revu, non touché** |
| Rôles | `Dispatch` / `Admin` | `Dispatch` / `Admin` | Aucun écart |
| Édition d'un compte | popup générique cellule par cellule, Discard / Confirm | dialogue « Edit user — `<email>` », Cancel / Confirm | Présentation |
| Compte désactivé | ✏️ et ❌ grisés, sous-ligne rouge « Deactivated `<date>` » | **identique** — actions désactivées, « Deactivated `<date>` » sous la date d'activation | Aucun écart |
| Téléphone dans la liste | `intlPhone(a.mobile)` | `formatPhoneDisplay` — vérifié à l'écran : `+33 6 12 34 50 00` | Aucun écart |

### Ajouts v2 sans équivalent legacy

**« Set a new password »** par ligne (`PATCH /users/:id/password`) — le legacy n'avait aucun mot de
passe par compte, donc rien à changer ; côté v2 c'est le trou déjà comblé et consigné dans l'audit
(§ « Trou propre à v2, comblé »). La fiche société est aussi affichée **en lecture seule** avant
édition, ce que le legacy ne faisait pas (ses champs étaient des `<input disabled>`).

**Bilan `/settings` : 1 feature legacy manquante** (la référence lisible d'un compte d'accès),
à trancher par Romain ; les deux autres écarts relevés sont l'un déjà tranché, l'autre sans objet.

## `/driver/:ref` ↔ `/chauffeur.html?ref=…`

Legacy comparé : `http://localhost:4100/chauffeur.html?ref=R-CI2-26-1` (+ `public/chauffeur.html:37-115`).
État de données créé à la main côté legacy : un compte `CI2` (Hélène D'Arcy), un chauffeur
`D•FR•INT•2` (Karim Haddad), et une course `R-CI2-26-1` Nice → Negresco assignée à ce chauffeur —
sans quoi la page ne rend rien.
Côté v2 : `R-CI22-26-1`, la course créée pour le flux §5, **ouverte en fenêtre déconnectée**
(contexte navigateur isolé, `document.cookie` vide).

**Inventaire legacy** : bandeau `REF <ref>` + `Hello <driverName || 'Driver'>` ; bandeau d'erreur
(`lastError`) ; bandeau d'avertissement quand `tracking === false` ; bloc d'infos Account /
Passenger (`· N pax`) / POC WhatsApp / Date+heure / Pickup / Destination / Vehicle ; deux étapes
automatiques (`Sent to driver`, `Received by driver`, sans bouton, « Automatic » tant qu'elles ne
sont pas horodatées) ; cinq étapes à bouton (`Accepted by driver`, `On the way`, `In position`,
`Passenger on board`, `Drop-off completed`) ; note de pied de page.

### Features legacy sans équivalent v2

**Aucune.** Tout est porté, y compris ce qui ne se voit qu'en mode dégradé et qui a été lu dans le
code des deux côtés :

| Règle legacy | Où | v2 |
|---|---|---|
| `tracking === false` → bandeau « Tracking disabled for this trip: steps are recorded but no WhatsApp message is sent. » | `chauffeur.html:101` | `driver-page.tsx:93` |
| `tracking === false` → la ligne **POC WhatsApp est masquée** | `chauffeur.html:104` | `driver-page.tsx:105` |
| Libellé du bouton : `Resend` si l'étape est faite, sinon `Notify` (tracking) ou `Mark` (sans tracking) | `chauffeur.html:90-91` | `driver-page.tsx:130` |
| Horodatage : « Sent at » avec tracking, « Marked at » sans | `chauffeur.html:88` | `driver-page.tsx:139` |
| Ref inconnue → « Trip not found for ref … » | `chauffeur.html` | vérifié à l'écran sur `/driver/R-NOPE-99-9` |

### Écarts de règle sur des contrôles présents des deux côtés

| Contrôle | Legacy | v2 | Verdict |
|---|---|---|---|
| **Format de la date** | `2026-09-05 at 09:15 (local time)` — la chaîne ISO brute stockée sur la course | `05/09/2026 at 09:15 (local time)` | **Écart réel, cosmétique.** v2 applique le format `dd/MM/yyyy` qu'il utilise partout ailleurs. **Recommandation : ne rien changer** — l'ISO était un effet de bord du stockage legacy (`pickupDate` était une chaîne), pas une intention |
| **Téléphone du POC** | `33612345678` brut | `+33 6 12 34 56 78` | Ajout v2 |
| Icônes d'étape | emoji (`✈️ 📨 👍 🚗 📍 🧍 🏁`), remplacés par `✓` une fois faits | icônes lucide, même progression | Présentation |
| Note de pied de page | « …sends a WhatsApp message to the POC **via Twilio** — no further action required. » | « …sends a WhatsApp message to the POC — no further action required. » | Cosmétique (v2 ne nomme pas son transporteur à un chauffeur) |
| Rafraîchissement | polling 5 s | SSE — **vérifié en direct** pendant le flux §5 | Modernisation actée (§ audit 🔵) — **revue, non touchée** |

**Bilan `/driver/:ref` : aucune feature legacy manquante.**

## `/track/:ref` ↔ `/dashboard.html?ref=…`

Legacy comparé : `http://localhost:4100/dashboard.html?ref=R-CI2-26-1` (+ `public/dashboard.html:29-70`),
même jeu de données créé à la main que ci-dessus. Côté v2 : `/track/R-CI22-26-1` et
`/track/R-CC1-26-1`, **en fenêtre déconnectée**.

**Inventaire legacy** : bandeau `● REF <ref> — live tracking` ; titre = nom du passager (à défaut le
compte) ; bloc Account / **Driver** (`driverName || 'To be confirmed'`) / Date+heure / Pickup /
Destination / Vehicle ; quatre étapes **sans bouton** (`Trip accepted`, `In position`,
`Passenger picked up`, `Dropped off`), horodatées « Confirmed at `hh:mm` » une fois faites ; note de
pied de page.

### Features legacy sans équivalent v2

**Aucune.** Même bloc d'infos, mêmes quatre étapes, même wording « Confirmed at », même repli
« To be confirmed », même message pour une ref inconnue. Les étapes intermédiaires que la page
chauffeur affiche (`Sent to driver`, `Received by driver`, `On the way`) sont volontairement
**absentes des deux côtés** : le passager n'a pas à les voir.

### Écarts de règle sur des contrôles présents des deux côtés

| Contrôle | Legacy | v2 | Verdict |
|---|---|---|---|
| Format de la date | ISO brut | `dd/MM/yyyy` | Même écart que la page chauffeur, même recommandation |
| Note de pied de page | « This page refreshes automatically every 5 seconds. » | « Updates live — no need to refresh this page. » | **La phrase suit le mécanisme** : v2 est en SSE, la note ne pouvait pas rester. Modernisation actée — **revue, non touchée** |
| `paxCount` | non affiché | non affiché | Aucun écart |

### Corrigé au passage sur ces deux pages

`df33a51` — un partenaire enregistré comme **société sans personne nommée** (`Uber`,
`Manual Test Partners` en base de dev) n'avait plus de nom du tout dans la projection publique :
`toPublicTrip` composait `driverName` avec `driverDisplayName` (prénom + nom), vide sur ces
enregistrements. `/track/R-CC1-26-1` affichait donc « Driver — **To be confirmed** » sur une course
pourtant confiée à Uber, et le message WhatsApp au POC sortait en « this is **, the driver** ».
Ce n'est **pas** un écart avec le legacy — le legacy stockait son partenaire en texte libre et
n'affichait rien non plus — mais un bug propre à v2, dont le modèle *prévoit* d'afficher le
partenaire. Corrigé avec `driverLabel` (nom → société → ref).

## Synthèse

**14 features legacy sans équivalent v2** ont été relevées sur les douze écrans. Elles se
répartissent ainsi :

| Sort | Nombre | Lesquelles |
|---|---|---|
| **Déjà tranchées dans l'audit — revues, non touchées** | 4 | popups d'édition rapide des 6 cellules (`/bookings`), `offerEventReactivation` (`/events`), porte mot de passe Owner (`/settings`), portes mot de passe Manager sur la suppression définitive (`/clients`, `/drivers`, `/vehicles`) |
| **Sans objet en v2** | 4 | résumé « Flight info » cliquable et icône 📤 du badge (`/bookings`), auto-synchro du POC Full Name et validation live de l'acronyme (`/clients`), ❌ « Delete » d'un compte d'accès (`/settings`) — comptés comme un seul item chacun |
| **Oublis à porter, effort faible** | 5 | tooltip POC de `/bookings` ; colonnes **Country** de `/clients` et de `/drivers` ; colonne **POC** et **dates d'événement** de `/clients` |
| **À trancher par Romain** | 3 | **Country requis** sur le formulaire chauffeur (validation perdue) ; colonne **Company / « In-house »** de `/drivers` ; **référence lisible** d'un compte d'accès (`/settings`) |

Cinq écrans n'ont **aucune feature manquante** : `/login`, `/vehicles`, `/planning`, `/invoicing`,
`/finance`, plus les deux pages publiques `/driver/:ref` et `/track/:ref`.

### Les trois plus coûteuses à laisser tomber

1. **`offerEventReactivation`** (`/events`, `common.js:3905-3980`). Sans elle, un événement
   récurrent — le Grand Prix, un festival, une régate qui revient chaque année au même endroit —
   impose de re-saisir toute son équipe : chaque chauffeur `eventsOnly` et chaque véhicule
   `eventsOnly` de l'édition précédente reste dormant et doit être rouvert un par un pour être
   relié au nouveau compte Events. Le coût est proportionnel à la taille de l'équipe, et il tombe
   exactement au pire moment, la veille de l'événement. **Le mécanisme de détection existe déjà
   côté v2** (`outsideEventWindowFilter`, `assignability.ts:56-69`, écrit pour ça et aujourd'hui
   inutilisé) : il ne manque que la popup et un `PATCH` par enregistrement retenu. C'est la plus
   coûteuse des quatorze, et la moins chère à rattraper.
2. **Le tooltip POC de `/bookings`** (`common.js:3108`). C'est la seule information de la ligne
   qu'on ne peut plus obtenir sans ouvrir le dialogue d'édition — et c'est celle qu'on cherche
   quand un passager n'est pas au point de rendez-vous. Le legacy la donnait au survol. Effort :
   un `<Tooltip>` sur la cellule passager, les données sont déjà chargées.
3. **Les colonnes Country de `/clients` et de `/drivers`** (`common.js:3369`, `:3531`). Prises
   isolément ce sont deux colonnes ; prises ensemble elles font que **le pays d'un compte ou d'un
   chauffeur n'est plus lisible nulle part dans une liste** — il faut ouvrir chaque fiche. Or le
   pays commande la devise de facturation, l'éligibilité chauffeur et le format de référence. Même
   effort minimal, même angle mort : les deux listes ont été redessinées sans lui.

Deux points de méthode, valables au-delà de cette passe :

- **Les commentaires du legacy contredisent son code à trois reprises** — le lien véhicule↔chauffeur
  « éditable » qui ne l'est pas (`vehicles.html:497-498`), la période de facturation « mois courant »
  qui est le mois précédent (`invoicing.html:220-233`), et le format de référence chauffeur
  « FR-INT-001 » qui est en réalité `FR•INT•1` (`server.js:511-515`). v2 a suivi le **code** dans
  les deux premiers cas et le **commentaire** dans le troisième. Ne pas se fier aux commentaires du
  legacy sans vérifier le code en face.
- Ce relevé **confirme** le §15 de `docs/LEGACY_PARITY_AUDIT.md` partout où il a été recoupé, à une
  exception près : le §1.3 affirme que les endpoints `DELETE` « ne sont protégés par aucune
  permission (un DISPATCHER peut supprimer) ». C'est **faux aujourd'hui** — `record:delete` est
  `[ADMIN]` seul dans `permissions.ts` et la vérification au `curl` l'a confirmé (voir le rapport
  QA). Cette ligne de l'audit est périmée.

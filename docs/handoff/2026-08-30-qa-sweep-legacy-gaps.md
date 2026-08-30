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


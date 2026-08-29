# Audit de parité métier — legacy `suivi-chauffeur-twilio` vs `cockpit-v2`

> Comparaison exhaustive ligne à ligne, feature par feature / modèle par modèle.
> Sources lues intégralement : legacy `server.js` (2736 l.), `public/common.js` (4474 l.),
> les 14 pages `public/*.html` ; côté v2 : `apps/api/src/**`, `apps/api/prisma/schema.prisma`,
> `apps/web/src/features/**`.
>
> **Seuls les écarts de LOGIQUE MÉTIER sont listés.** Les écarts purement visuels
> (shadcn vs CSS maison, icônes lucide vs emoji, thème sombre, mise en page) ne le sont pas.
>
> Légende : 🔴 régression / bug — 🟠 changement de règle assumé mais réel —
> 🟡 règle ou feature legacy non portée — 🔵 modernisation documentée, sans impact métier — ✅ conforme.

---

> **État (2026-08-29) : refermé après DEUX passes.** La première (2026-08-28) a corrigé les 6 bugs
> et la plupart des règles non portées, puis s'est déclarée close — à tort. Une seconde passe
> indépendante le 2026-08-29 a trouvé **5 bugs métier de plus et une quinzaine de règles legacy
> encore non portées** : voir §15, qui fait foi. Les sections 1 à 13 restent le relevé
> feature-par-feature, avec les corrections apportées par §15 signalées en face.
>
> **Ce document a été faux.** Cinq de ses lignes affirmaient une conformité qui n'existait pas, ou
> déclaraient ouvert un point déjà corrigé (3.7, 5.5, 6.6.1, 8.5, 7.4). Elles sont rectifiées
> ci-dessous. La leçon est en tête de §15 : vérifier l'appelant, pas seulement l'endpoint.

## 0. Synthèse — les 3 régressions bloquantes (corrigées)

| # | Domaine | Écart | Impact |
|---|---------|-------|--------|
| **B1** | Trips / listing | La règle « course passée + chauffeur assigné → masquée » est devenue **globale côté serveur**, y compris pour `period=all`. Dans le legacy c'était une règle d'affichage **de la seule page Bookings**. | **La facturation ne voyait plus aucune course passée ayant un chauffeur** → panneau « Pending » vide dans le cas nominal. Idem Partner log, Events (historique), Planning (dates passées). <br>**Corrigé :** la fenêtre devient un paramètre opt-in `board=true` sur `GET /trips`, envoyé par la seule page Bookings. |
| **B2** | Trips / WhatsApp | `buildTripMessageContext` lisait `pickupAt` avec les getters **UTC** (le commentaire affirmait un stockage « naïf », faux : `toPickupAt` convertit bien wall-clock+tz → UTC). | **Tous les messages WhatsApp annonçaient l'heure en UTC** en écrivant « (local time) ». Un PU Paris 14:00 été → « at 12:00 (local time) ». <br>**Corrigé :** lecture via Luxon dans `trip.timezone` (repli UTC si absente), couvert par `trip-message.util.spec.ts`. |
| **B3** | Company info | `CompanyService.update()` renvoyait 409 dès que `saved=true`. | La fiche société **n'était plus jamais modifiable**. Le legacy la rouvrait via le crayon + mot de passe Owner (`owner.html:269-280`), autant de fois que voulu. <br>**Corrigé :** verrou serveur retiré ; l'onglet Settings affiche la fiche en lecture seule avec un crayon qui rouvre le formulaire (+ Cancel), la permission `company:edit` jouant le rôle de l'ancien mot de passe. |

---

## 1. Authentification, sessions, comptes

| # | Type | Écart |
|---|------|-------|
| 1.1 | 🔵 | Compte admin unique en `.env` → vraie table `User` multi-comptes avec rôles `ADMIN`/`DISPATCHER`, sessions et OTP en base. La table `accessRecords` (annuaire décoratif dans le legacy) devient l'authentification réelle. Modernisation prévue (LEGACY_FEATURES §11). |
| 1.2 | 🟠 | **Toutes les portes « mot de passe Manager/Owner » deviennent des permissions de rôle.** Le legacy re-demandait un mot de passe à chaque action sensible ; v2 se contente du rôle `ADMIN`. Correspondance vérifiée : `trip:cancel`, `trip:edit-past`, `trip:edit-price`, `client:edit`, `client:create-past-event`, `driver:reactivate`, `vehicle:reactivate`, `company:edit`, `user:manage`. Toutes portées. |
| 1.3 | 🟡 | **Portes legacy sans équivalent v2** : suppression définitive d'un compte client / chauffeur / véhicule (`common.js:388`, gate mot de passe Manager). Côté v2 les endpoints `DELETE` existent, **ne sont protégés par aucune permission** (un DISPATCHER peut supprimer), et ne sont exposés nulle part dans l'UI. |
| 1.4 | 🟠 | Réf. des comptes d'accès `D-001` / `O-001` (séries indépendantes par rôle, zero-pad 3) : **supprimée**. Les `User` v2 n'ont qu'un `cuid`. |
| 1.5 | 🟠 | Champs compte : legacy `surname/name/mobile/email/role`. v2 `firstName/lastName/phone/email/role` **+ `password` obligatoire (min 8)**. Créer un compte dispatcher impose désormais de lui définir un mot de passe. |
| 1.6 | 🟠 **corrigé** | Login legacy comparait les emails **en minuscules** (`email.trim().toLowerCase()`). v2 fait un `findUnique({ email })` **exact**, sans normalisation dans `LoginDto`. Se connecter avec `Admin@x.com` alors que l'email stocké est `admin@x.com` échoue. |
| 1.7 | ⚪ | OTP : legacy `randomInt(100000, 999999)` (jamais de 0 en tête). v2 `randomInt(0, 1e6).padStart(6,'0')` (zéros en tête possibles). Sans impact. |
| 1.8 | 🔵 | Cookie de session : `Secure` désormais posé en production (le legacy ne le posait jamais). Durcissement. |
| 1.9 | ✅ | OTP 5 min / 5 tentatives, compteur d'essais incrémenté sur code faux sans invalider le code, session 7 j (`SESSION_TTL_DAYS`), `HttpOnly`+`SameSite=Lax`, `devCode` en mode dev uniquement : conformes. |

## 2. Fiche société (Company info)

| # | Type | Écart |
|---|------|-------|
| 2.1 | 🔴 **B3 — corrigé** | v2 **verrouille définitivement** la fiche après la 1ʳᵉ sauvegarde (`ConflictException`). Le legacy la rouvrait indéfiniment via le crayon + mot de passe Owner. |
| 2.2 | 🟠 | `GET /company-info` est désormais gated `company:edit` : un DISPATCHER ne peut **plus consulter** la fiche société. Le legacy la servait à toute session authentifiée. |
| 2.3 | ✅ | Les 13 champs, tous requis ensemble, `saved` : conformes (`country` → `countryCode`). |

## 3. Clients

| # | Type | Écart |
|---|------|-------|
| 3.1 | 🟠 | `email` devient **unique en base**, validé au format et normalisé (trim + lowercase). Le legacy acceptait n'importe quoi, doublons compris. Deux comptes ne peuvent plus partager un email. |
| 3.2 | 🟠 | `pocEmail` validé au format (legacy : texte libre). |
| 3.3 | 🟠 | Le `DELETE` définitif est **refusé** si le compte porte des courses ou des factures. Le legacy supprimait toujours (laissant des `clientRef` orphelins). |
| 3.4 | 🟠 | Le `PUT` exige désormais pays/area/plage de dates pour un compte Event. Le legacy ne contrôlait que `company` en édition (le contrôle complet n'existait qu'à la création). |
| 3.5 | 🟠 | Le `PUT` **efface** les champs événement quand le type n'est plus `EVENT`. Le legacy les conservait. |
| 3.6 | 🟠 | La liste est **paginée (20/page)** et **masque les inactifs par défaut** (bascule « show inactive »). Le legacy renvoyait tout, inactifs grisés en bas de liste. |
| 3.7 | ✅ / 🟠 | Séries `CI/CC/CE{n}` indépendantes, `name` dérivé (company → contact → `Account {ref}`), `pocName` retombant sur le nom du contact, `pocPhone` normalisé chiffres, champs événement forcés `null` hors type Event à la création : conformes. **Rectification 2026-08-29 :** le tri ne l'est pas — legacy actifs puis `ref`, v2 actifs puis `createdAt` (idem chauffeurs, véhicules, comptes). Écart réel, **assumé** (§15). |
| 3.8 | ✅ | Porte « créer un événement dans le passé » (`clients.html:474` / `events.html:439`, mot de passe Owner) → `client:create-past-event`. Portée. |

## 4. Chauffeurs & partenaires

| # | Type | Écart |
|---|------|-------|
| 4.1 | 🟠 | **Format de référence changé** : `D•FR•INT•1` → `D-FR-INT-001` (tiret + zero-pad 3). v2 a suivi le commentaire du legacy plutôt que son implémentation réelle. Les références produites diffèrent de celles du legacy. |
| 4.2 | 🟠 | `phone` devient **unique en base** : le `PUT` renvoie 409 sur un doublon. Le legacy ne dédupliquait qu'à la création (le `PUT` pouvait créer des doublons). La déduplication à la création (renvoi du chauffeur existant) est bien conservée. |
| 4.3 | 🟡 | **Popup « Link to an Event » non portée telle quelle.** Legacy : la liste d'événements était filtrée sur *événements non terminés* + *même pays* + *même area que la fiche*, et les champs Country/Area étaient en lecture seule (recopiés de la fiche). v2 : deux champs libres + une liste d'événements **non filtrée**. |
| 4.4 | 🟡 | **`offerEventReactivation` non portée** : à la création d'un nouvel événement, le legacy proposait de re-rattacher les chauffeurs/véhicules déjà configurés pour ce pays/area lors d'un événement précédent. |
| 4.5 | 🟠 | Liste paginée + actifs seulement par défaut (cf. 3.6). |
| 4.6 | 🟠 | `DELETE` chauffeur : v2 supprime aussi l'indisponibilité, mais échouera sur la contrainte FK si des courses le référencent (500). Le legacy supprimait en laissant des orphelins. |
| 4.7 | ✅ | L'arbre de validation conditionnel (Events / interne / société partenaire / chauffeur partenaire), le préfixe de réf. (interne toujours `FR-INT`), le `area` par défaut `Local`, la réf. figée après création, l'indisponibilité en setter séparé (off / holidays / sick + contrôles de dates) : conformes. |
| 4.8 | ✅ | Porte de réactivation (`common.js:3596`) → `driver:reactivate`. Portée. |

## 5. Types de véhicule & flotte

| # | Type | Écart |
|---|------|-------|
| 5.1 | 🟠 | **Nouveaux endpoints** sur les types de véhicule : `PUT`, `DELETE`, `PATCH /active` + colonne `active`. Le legacy n'avait que `GET` et `POST` (un type était incréable-inéditable-insupprimable). Ajout, pas de perte. |
| 5.2 | 🟠 **corrigé** | `/meta` renvoyait **tous** les types de véhicule, y compris désactivés (`findMany()` sans filtre) → un type désactivé reste proposé dans la barre de réservation. Incohérence introduite par 5.1. |
| 5.3 | 🟠 | `FleetVehicle.driverId` est **unique** : un chauffeur ne peut être réservé qu'à un seul véhicule (409 sinon). Le legacy n'avait aucune contrainte (`findLinkedVehicleFor` prenait le premier trouvé). |
| 5.4 | 🟠 | `PATCH /:ref/driver` refuse désormais de lier un chauffeur à un véhicule **local**. Le legacy l'acceptait (et le `PUT` le remettait à `null` ensuite). |
| 5.5 | ✅ **rectifié** | `acr` > 6 caractères : le 400 est bien en place (`@MaxLength(6)` sur le DTO + `slice(0,6)` défensif). Cette ligne décrivait un écart déjà corrigé. |
| 5.6 | 🟠 | Liste paginée + actifs seulement par défaut (cf. 3.6). |
| 5.7 | ✅ | Toute la chaîne de validation création/édition est portée à l'identique : local/externe (pays+area+partenaire requis), catégorie existante, `regNbr` requis et unique insensible à la casse, `make` ∈ `FLEET_MAKES`, `model` ∈ `FLEET_MODELS_BY_MAKE`, couple make/model ∈ `CATEGORY_MODELS[category]`, `yob` dans la fenêtre glissante 10 ans, 4WD, `nbPax` 0–50, couleur ∈ palette. Indisponibilité réservée aux véhicules internes, `driverRef` non écrasé si absent du body : conformes. |
| 5.8 | ✅ | `defaultFleetPax` (nb pax auto par catégorie/modèle) porté verbatim. |

## 6. Courses (trips) — cœur métier

### 6.1 Listing / visibilité

| # | Type | Écart |
|---|------|-------|
| 6.1.1 | 🔴 **B1 — corrigé** | `TripsService.list()` appliquait **inconditionnellement** `OR: [pickupAt >= début de journée Paris, driverId = null]`, y compris quand `period=all`. Dans le legacy, cette règle (`baseVisibility`, `dispatcher.html:349-363`) n'était appliquée **que** par la page Bookings ; Events, Planning et Invoicing lisaient `GET /api/trips` sans elle. Conséquences mesurées : Invoicing « Pending » (`period:'all'`) ne voit plus une seule course passée assignée ; `computeCustomerDefaultPeriod` calcule le « plus vieux impayé » sur une liste déjà tronquée ; Partner log, Events ride list et le Gantt Planning perdent leur historique. |
| 6.1.2 | ✅ | Le filtre `period` (upcoming par défaut / today / week / past / all) est porté fidèlement, en zone Paris, avec les mêmes bornes que `periodMatches`. |
| 6.1.3 | ✅ | Split Local / Farm out (`isLocalTrip` : area ∈ Nice/Cannes/St-Tropez, ou pays MC, ou texte PU/DO), séparation Daily / Event par type de compte client, recherche ref/compte/passager/chauffeur, filtres client/chauffeur/passager/véhicule/service : portés à l'identique. |

### 6.2 Création

| # | Type | Écart |
|---|------|-------|
| 6.2.1 | 🟠 | Un `driverRef` / `partnerRef` / `vehicleType` non résolu renvoie désormais **400**. Le legacy les ignorait silencieusement (course créée sans chauffeur). |
| 6.2.2 | 🟡 **corrigé** | Le champ **`nameboard` (texte à écrire sur la pancarte) avait disparu**. Seul le fichier joint subsiste (`nameboardUrl`, upload réel — bon remplacement du base64), mais il n'y a plus de champ pour le nom. |
| 6.2.3 | 🔵 | `lang` supprimé (champ mort dans le legacy, jamais utilisé). |
| 6.2.4 | ✅ | Toutes les validations sont portées : `passengerName`, pays/date/heure/PU requis, DO requis sauf ASD, ASD → `hours` 2–48, SPEC → instructions, `paxCount ≤ maxPax`, `fleetRegNbr` résolu + compatibilité de catégorie, note auto « Need to remove seats » (Lugg. + Van), aucune création à la volée de client/chauffeur, cascade POC (course → compte client → nom du passager), refus si aucun téléphone POC, `billing` retombant sur celui du compte, `area` par défaut `Local`, timezone dérivée du pays, `ref` manuel avec 409 sur collision, verrou sous-traitance (`subContractor && !partner` → `transmitted` + `dispatched=true` immédiats). |
| 6.2.5 | ✅ | Règle « Create » vs « Create & Dispatch » (le Create simple n'attache **jamais** driver/vehicle, mais conserve la sous-traitance) portée à l'identique, garde de conflit driver+partner incluse. |

### 6.3 Modification

| # | Type | Écart |
|---|------|-------|
| 6.3.1 | 🔴 **corrigé** | **`dispatched` n'était plus remis à `false` à chaque édition.** Legacy (`server.js:2470`) : *toute* sauvegarde repasse le bouton « Send » en actif, pour forcer un renvoi au chauffeur avec les nouvelles infos. v2 ne le remet à `false` **que** si le chauffeur ou le partenaire change. Changer une date, un lieu de PU ou un véhicule ne redemande plus de renvoyer la course. |
| 6.3.2 | 🟠 | La note auto « Need to remove seats » est désormais appliquée **aussi à la mise à jour** (logique factorisée dans `resolveTripInputs`). Le legacy ne la calculait qu'à la création. |
| 6.3.3 | 🟠 | La réassignation efface aussi `cancellationFee` (le legacy le conservait). |
| 6.3.4 | ✅ | Regénération de la ref + libération de l'ancien slot au changement de compte, reset complet des `steps` + `assignmentCancelled` à la réassignation, verrou sous-traitance ré-appliqué, `subContractor`/`partnerRef` écrits seulement si présents dans le body, notification « updated » best-effort qui ne bloque jamais la sauvegarde : conformes. |
| 6.3.5 | ✅ | Portes `trip:edit-past` et `trip:edit-price` : équivalent fidèle des `promptAdminPassword` de `openEditTripModal` / `quickUpdateTrip`. |

### 6.4 Workflow de statut

| # | Type | Écart |
|---|------|-------|
| 6.4.1 | 🟠 | `GET /trips/:ref?viewer=driver` **tamponne aussi `TRANSMITTED`** s'il manque, et accepte un **partenaire** comme assigné. Le legacy ne tamponnait que `received`, et seulement si `driverRef` était posé. |
| 6.4.2 | 🟠 | `POST /trips/:ref/notify` (page chauffeur publique) est **refusé** si la course est annulée. Le legacy l'acceptait encore. |
| 6.4.3 | ✅ | `FULL_STEP_ORDER`, `STEP_ORDER`, calcul de l'étape suivante, blocages (annulée / sous-traitance verrouillée / déjà à la dernière étape), `tracking=false` → étape horodatée sans WhatsApp (`skipped:true`), échec Twilio bloquant sur `advance-step`/`notify` mais best-effort sur le `PUT`, `dispatch-driver` (chauffeur puis partenaire en repli, `dispatched=true` + `transmitted`) : portés à l'identique. |
| 6.4.4 | ✅ | Badge de statut : `HIGHLIGHTED_STEPS`, `ADVANCEABLE_STEPS`, verrou sous-traitance, urgence H-6/H-3/H-1 en heure de Paris, ligne rouge si annulée. Conformes. |
| 6.4.5 | ✅ | Annulation : « Free » ou absente → suppression + libération de la ref ; frais non nul → conservation, chauffeur retiré, `assignmentCancelled`. Conforme. |

### 6.5 Messages WhatsApp

| # | Type | Écart |
|---|------|-------|
| 6.5.1 | 🔴 **B2 — corrigé** | `buildTripMessageContext` extrait la date/heure via `toISOString()` (UTC) alors que `pickupAt` est un **instant réel** (le front convertit wall-clock + timezone du PU → UTC dans `toPickupAt`). Tous les templates qui affichent l'heure (`updated`, `accepted`, `driverDispatch`) annoncent donc **l'heure UTC** en la libellant « (local time) ». Le legacy envoyait la vraie heure locale. |
| 6.5.2 | ✅ | Les 7 templates sont repris **verbatim**, anglais uniquement, envoyés au POC (sauf `driverDispatch` → chauffeur/partenaire). |

### 6.6 Assignation & endpoints nouveaux

| # | Type | Écart |
|---|------|-------|
| 6.6.1 | ✅ **rectifié** | *(La notification « updated » au POC et le verrou de sous-traitance sont en place depuis la 3ᵉ passe du 2026-08-28 ; cette ligne les listait encore comme manquants.)* Nouvel endpoint `PATCH /trips/:ref/assign` (drag & drop Planning) qui **ne faisait pas** : regénération de ref, verrou sous-traitance, notification « updated » au POC, contrôle `trip:edit-price`, auto-assignation du véhicule réservé. (Le réarmement de `dispatched` y a été aligné sur le legacy, cf. 6.3.1.) Le legacy passait par le `PUT` complet via `quickUpdateTrip` (avec `notifyDriver: hadDriver`). |
| 6.6.2 | 🟡 | **Les popups d'édition rapide ne sont pas portées** (cellules cliquables Compte / Passager+POC / Véhicule / Reg Nbr / Sub-C / Chauffeur). Avec elles disparaissent : la règle `isBeforeArrival` (le POC n'est modifiable que tant que le chauffeur n'est pas « In position »), l'auto-assignation du véhicule réservé au chauffeur, et le déclenchement des brouillons d'email de sous-traitance. |
| 6.6.3 | 🟡 | **Brouillons d'email de sous-traitance non portés** : `openSubcontractEmailDraft` (mailto au partenaire avec le récapitulatif complet de la mission + tarif partenaire dans la devise du pays) et `openCanceledSubcontractEmailDraft` (annulation, signée du nom de la société lu depuis `/api/company-info`). |

## 7. Tarification & devises — écart significatif

| # | Type | Écart |
|---|------|-------|
| 7.1 | 🟠 **écart assumé et documenté** | **Sémantique de devise inversée.** Legacy : « Retail net » saisi dans la **devise retail** (`bookingCurrency()` : EUR / CHF / GBP, sinon USD selon le pays) et « Partner rate net » dans la **devise du pays de la course** ; les deux stockés bruts dans `priceEur` / `partnerRate` (d'où des totaux de facture hétérogènes — bug legacy). v2 : les deux champs sont **en EUR** (suffixe €), l'indication convertit EUR → devise locale. C'est une correction, mais les nombres saisis et stockés n'ont plus le même sens que dans le legacy, et les totaux de facture changent. <br>**Décision (2026-08-28) : on garde l'EUR.** Le legacy additionnait des euros, des francs suisses et des dollars dans un même `totalHT` — ses totaux de facture étaient faux dès qu'un client avait des courses hors zone euro. C'est une mauvaise conception, pas une règle métier : la fidélité ne s'y applique pas. |
| 7.2 | 🟡 **corrigé** | **Le calcul de marge avait disparu.** Legacy `updateMarginHint` : France → `(retail − partenaire) / retail` ; étranger → `((retail / 1.1) − partenaire) / (retail / 1.1)` (on retire la TVA française du retail, le tarif partenaire étranger n'en portant pas). Restauré tel quel — le `/1.1` porte sur la TVA, pas sur la devise, donc la formule vaut inchangée en EUR. `marginPercent()` dans `packages/shared/src/business/pricing.js`, affiché sous le Partner rate. |
| 7.3 | 🟡 **corrigé** | Les indications « Total net = tarif × Nb H » pour un service ASD (`updateAsdTotalHints`) sont restaurées (`asdTotal()`, même module partagé). |
| 7.4 | ✅ **corrigé le 2026-08-29** | La règle des 4 devises retail (EUR / CHF / GBP, **USD partout ailleurs**) est portée : `retailCurrency()` dans `packages/shared/src/business/pricing.js`, appliquée au champ Retail net. §14 la déclarait fermée en la rangeant sous la décision 7.1 — à tort : 7.1 traite du **stockage** des montants, 7.4 de la **devise dans laquelle on les lit**. La table des ~70 symboles reste non portée (le code ISO est affiché) : cosmétique. |

## 8. Barre de réservation — règles d'assignation

| # | Type | Écart |
|---|------|-------|
| 8.1 | 🟡 **corrigé (backend)** | **`driverEligibleForTrip` n'était pas portée.** Legacy : chauffeur « Events » → uniquement les courses Events ; chauffeur interne (sans société) → toutes les courses daily, et les courses Events **seulement si locales** ; chauffeur partenaire → uniquement les courses daily. Portée dans l'API (`common/business/assignability.ts`, filtre Prisma) et exposée via `GET /drivers?tripClientRef=&tripArea=&tripCountryCode=&tripPickupLocation=&tripDropoffLocation=` — le picker envoie le brouillon de course, comme le legacy avec `draftTripForEligibility()`. |
| 8.2 | 🟡 **corrigé (backend)** | **`isEffectivelyActive` n'était pas portée** (`active` + fenêtre d'événement + fenêtre d'indisponibilité). Conséquence : un chauffeur en congé / arrêt maladie / jour off, ou un véhicule au garage (réparation / révision / carrosserie), **reste proposé à l'assignation** ; un chauffeur/véhicule rattaché à un événement reste proposé **hors des dates de cet événement**. Portée dans l'API sous `GET /drivers?availableOnly=true` et `GET /fleet-vehicles?availableOnly=true`. Filtre Prisma et non prédicat JS : la liste étant paginée, un filtre côté front n'aurait vu que la page affichée. |
| 8.3 | 🟡 **corrigé (backend)** | L'auto-assignation du véhicule réservé au chauffeur est restaurée — côté serveur cette fois (`TripsService.findReservedVehicle`), ce qui couvre d'un seul endroit la création, l'édition et le drag & drop du Planning, là où le legacy la dupliquait dans deux fonctions front. Ne se déclenche qu'à une (ré)assignation réelle du chauffeur et jamais par-dessus un Reg Nbr choisi explicitement. |
| 8.4 | 🟠 **corrigé** | Le filtre `isLocal` surnuméraire est retiré (le legacy proposait aussi les véhicules externes) et le filtre de disponibilité est rétabli. La compatibilité de catégorie passe elle aussi côté serveur (`compatibleWith`). |
| 8.5 | ✅ **rectifié** | *(Corrigé : `GET /meta/areas` + `area-suggestions.ts`, cf. §14. Cette ligne restait listée comme ouverte à tort.)* Le champ **Area était devenu un texte libre**. Legacy : combobox sur les grandes villes du pays sélectionné, plafond par zone (US 3 / FR 25 / Europe 12 / reste 5), valeur « Local » **sélectionnable uniquement pour la France**, champ vidé à chaque changement de pays. Cette règle compte : `area` alimente le split Local / Farm out et l'éligibilité chauffeur. |
| 8.6 | 🟡 **corrigé** | **Le pré-remplissage FBO n'était pas branché** : l'endpoint `GET /geo/fbo-lookup` existe côté API mais n'est appelé nulle part dans le front. `LocationField` appelle désormais `/geo/fbo-lookup` quand le PU est détecté comme aéroport, sans jamais écraser une adresse déjà saisie. |
| 8.7 | 🟠 | La popup « Flight info » ne s'ouvre plus automatiquement (et de façon bloquante) quand le PU est détecté comme un aéroport ; les champs sont inline, affichés dès qu'un code IATA est présent. |
| 8.8 | 🟡 **corrigé** | Le champ Reg Nbr est de nouveau désactivé pour un brouillon non local. Différence assumée : le legacy *vidait* aussi le champ, ce que v2 ne fait pas — le même composant sert la création et l'édition, et vider effacerait le véhicule d'une course non locale existante à la simple ouverture du dialogue. |
| 8.9 | ✅ | Gardes de formulaire portées : pax > capacité, ASD sans heures, SPEC sans instructions, Sub-C sans partenaire, et la garde de conflit « driver+véhicule ET partenaire » sur Create & Dispatch. |
| 8.10 | ✅ | Détection de timezone par géocodage du PU (Nominatim + tz-lookup), auto-remplissage du pays, indication « Eq. 🕐 Paris » : portées. |

## 9. Événements

| # | Type | Écart |
|---|------|-------|
| 9.1 | ✅ | **« Create bulk » porté verbatim** : une course par jour de la plage, chaînage jour 1 = PU/DO saisis puis PU = DO = drop-off du jour 1, dernier jour sans DO forcé en ASD (heures conservées si valides, sinon 4 h), instructions préfixées `Ref: …`, création séquentielle. |
| 9.2 | ✅ | Filtres de la ride list (client / pays / plage de dates / véhicule / nom d'événement / Ref-PO via le compte client) portés. |
| 9.3 | 🔴 **corrigé** | Impacté par **B1** : l'historique des courses d'événements passées assignées n'est plus visible. |

## 10. Facturation

| # | Type | Écart |
|---|------|-------|
| 10.1 | 🔴 **corrigé** | Impacté par **B1** — voir la synthèse. C'est l'impact le plus grave. |
| 10.2 | 🔵 | TVA : 10 % en dur → `DEFAULT_VAT_RATE_PERCENT` (défaut 10 %) + `vatRate` persisté par facture. Même résultat, extensible. |
| 10.3 | 🔵 | Le marquage `invoiced` est désormais atomique (`UPDATE … RETURNING` sous transaction), à l'épreuve des créations concurrentes. Le legacy pouvait double-facturer. |
| 10.4 | 🟡 | Le bouton « Corriger » (📝, porte mot de passe Manager + `alert()` « workflow non défini ») n'est pas porté. Il n'avait aucun backend : perte nulle. |
| 10.5 | ✅ | `totalHT` recalculé serveur, refs périmées/déjà facturées ignorées silencieusement, 400 si plus rien à facturer, `refPo` repris du compte client, séquence `INV{n}`, période, immuabilité : conformes. |
| 10.6 | ✅ | Filtres Customer (client/événement exclusifs, période, Ref-PO, passager), période par défaut = mois précédent élargie au plus vieil impayé, recouvrement de période pour les factures, Pending = filtrés non facturés, PDF/Excel/mailto « Send », onglet Partner log : portés. |

## 11. Planning

| # | Type | Écart |
|---|------|-------|
| 11.1 | ✅ | Le moteur de timeline est un **portage fidèle** : fenêtre 1–3 jours, largeurs, clip au passage de minuit, pile des non-assignés triée date puis heure, pas d'heure adaptatif, durée = 60 min ou `hours × 60` en ASD, couleurs par catégorie, contrôle de compatibilité au drop. |
| 11.2 | 🔴 **corrigé** | Impacté par **B1** : naviguer sur une date passée n'affiche plus rien de ce qui était assigné. |
| 11.3 | 🟡 | Les indisponibilités s'affichent bien en ligne de statut, mais n'excluent plus de l'assignation (cf. 8.2). |
| 11.4 | 🟠 | Le drag & drop passe par `assign` et ne notifie donc plus le POC (cf. 6.6.1). |

## 12. Pages publiques (chauffeur / suivi client)

| # | Type | Écart |
|---|------|-------|
| 12.1 | 🔵 | Le payload public est désormais **filtré** : POC (nom/téléphone) et instructions ne sont renvoyés qu'à la vue chauffeur. Le legacy exposait l'objet course complet — prix, tarif partenaire, POC — à quiconque possédait la ref. Durcissement. |
| 12.2 | 🔵 | Polling 5 s → SSE. Même fraîcheur, moins de charge. |
| 12.3 | ✅ | Page chauffeur (2 étapes auto en lecture seule + 5 boutons, libellés Notify/Mark/Resend, bandeau « tracking désactivé ») et page de suivi client (4 étapes, sans « enroute ») : portées à l'identique. |

## 13. Catalogues & lookups externes

| # | Type | Écart |
|---|------|-------|
| 13.1 | ✅ | `COUNTRIES` (210 entrées), `MAJOR_CITIES` (391), `FLEET_MAKES`, `FLEET_COLORS`, `FLEET_MODELS_BY_MAKE`, `CATEGORY_MODELS`, `VEHICLE_COMPATIBILITY`, `BILLING_OPTIONS`, `DEFAULT_VEHICLE_TYPES`, `AIRPORT_FBO_DIRECTORY`, `MESSAGES` : **comptes et contenus identiques**. |
| 13.2 | ✅ | `geocode-tz`, `geocode-search` (min 2 car., limit ≤ 8, filtre sur tz résolue), `simplifyAddress`, `isAirportResult`, extraction IATA/ICAO, `flight-check` (regex, tolérance ±90 min, mode dégradé si non configuré), `poc-search` (agrégation clients + courses, dédup insensible aux accents), `fx-rate` (cache 1×/jour, `eurPerUnit = 1/rate`) : portés fidèlement. |
| 13.3 | 🔵 | Le cache FX passe d'une Map mémoire à la table `FxRateCache`. |

---

## 14. Ce qu'il faut décider

**Corrigé (bugs, pas des choix) :**
1. ✅ **B1** — `GET /trips` accepte `board=true` ; la fenêtre « passé + assigné » ne s'applique plus que sur demande, et seule la page Bookings l'envoie. Invoicing / Events / Partner log / Planning retrouvent leur historique. Deux tests e2e couvrent les deux régimes.
2. ✅ **B2** — `buildTripMessageContext` lit `pickupAt` dans `trip.timezone` via Luxon. Nouveau `trip-message.util.spec.ts` (4 cas : Paris été, bascule de jour Tokyo, repli UTC, partenaire sous-traité).
3. ✅ **B3** — 409 retiré ; `saved` redevient « déjà renseignée une fois » et pilote la vue lecture seule + crayon côté Settings. Test e2e inversé.
4. ✅ `dispatched` — remis à `false` sur **toute** sauvegarde (`update()` comme `assign()`), sauf sous-traitance verrouillée. Les étapes, elles, ne sont effacées que sur changement d'assigné — exactement la règle legacy. Deux tests e2e mis à jour.
5. ✅ `/meta` — ne renvoie plus que les types de véhicule actifs (la page de gestion garde son propre endpoint non filtré).
6. ✅ Login — `LoginDto`/`VerifyDto` normalisent l'email ; `UsersService` et le seed le stockent normalisé.

**Porté le 2026-08-28 (2ᵉ passe) — les règles étaient écrites dans le legacy, il n'y avait rien à trancher :**
- ✅ Éligibilité chauffeur (8.1) et fenêtres d'indisponibilité / d'événement (8.2) — **dans le backend**,
  en filtres Prisma composables avec la pagination (`common/business/assignability.ts`).
- ✅ Auto-assignation du véhicule réservé (8.3) — backend, un seul endroit pour create / update / drag & drop.
- ✅ Calcul de marge (7.2) et totaux ASD (7.3) — `packages/shared/src/business/pricing.js`. Volontairement
  pas un endpoint : ce sont des indications recalculées à la frappe, un aller-retour par caractère serait
  le mauvais compromis.
- ✅ Filtres du sélecteur Reg Nbr (8.4), champ désactivé hors course locale (8.8), pré-remplissage FBO (8.6),
  champ texte nameboard (6.2.2).

**Décision produit actée (7.1) :** la sémantique de devise **ne revient pas** au legacy. Les montants
restent en EUR. Le legacy additionnait des devises hétérogènes dans `totalHT` : ses factures étaient
fausses hors zone euro. Mauvaise conception ≠ règle métier.

**Porté le 2026-08-28 (3ᵉ passe) — le reste de la liste, dans le même esprit : ce qui était écrit
dans le legacy a été porté, sans rien reclasser en « choix produit ».**
- ✅ **Permissions sur les `DELETE` définitifs (1.3)** — une seule permission `record:delete` pour
  les quatre routes, parce que le legacy avait une seule porte pour les quatre
  (`onPermanentDelete`, common.js:385-395). Aucune UI v2 ne les appelle encore, donc rien à
  miroiter côté front.
- ✅ **Champ Area contraint (8.5)** — `GET /meta/areas` + `common/business/area-suggestions.ts` :
  villes du pays plafonnées par zone (US 3 / FR 25 / Europe 12 / reste 5), « Local » réservé à la
  France, vidage au changement de pays. Le texte libre reste accepté : l'endpoint **suggère**, il ne
  ferme pas la liste — d'où `allowCustomValue` sur `SearchCombobox`.
- ✅ **Rattachement à un événement (4.3)** — filtres `eventCountry`/`eventArea`/`eventNotEnded` sur
  `GET /clients` **et** validation à l'écriture dans `EventLinkService`. Les champs « Event
  country/area » sont devenus des miroirs en lecture seule de la fiche, comme la popup legacy les
  affichait. Une fiche sans localisation propre ne peut plus être rattachée.
- ✅ **`offerEventReactivation` (4.4)** — `GET /clients/:ref/reactivation-candidates` +
  `POST /clients/:ref/reactivate`, en une transaction là où le legacy enchaînait N PUT. Proposé
  depuis les deux endroits où un compte Events se crée.
- ✅ **`isBeforeArrival` sur le POC (6.6.2)** — `packages/shared/src/business/trip-progress.js`, appliqué dans
  `update()`. Les popups d'édition rapide restent volontairement non portées.
- ✅ **`PATCH /trips/:ref/assign` (6.6.1)** — notification « updated » au POC selon la règle
  `notifyDriver: hadDriver`, et respect du verrou de sous-traitance. La régénération de ref et
  `trip:edit-price` sont **sans objet** ici : l'endpoint ne touche ni au compte client ni au prix.
- ✅ **Brouillons d'email de sous-traitance (6.6.3)** — `GET /trips/:ref/subcontract-email`, le
  front se contentant du `mailto:`. Le tarif partenaire est imprimé **en euros**, conformément à la
  décision 7.1.

**Reste ouvert :** rien de §14 — mais §14 avait tort de conclure que le chantier était clos.
Lire §15.


---

## 15. Deuxième passe — 2026-08-29

Relecture indépendante des deux codebases, sans se fier au présent document. Elle a trouvé
**5 bugs métier** et **une quinzaine de règles legacy non portées** que la première passe avait
manqués, et a établi que ce document était faux sur cinq points (rectifiés en face).

### Pourquoi la première passe est passée à côté

Deux angles morts, à garder en tête pour toute vérification future :

1. **Elle a vérifié les endpoints sans vérifier leurs appelants.** `GET /geo/geocode-search`,
   `GET /geo/poc-search` et les quatre `DELETE` existaient, étaient corrects, et **aucune UI ne les
   appelait** — classés « portés ». Même angle mort pour `isEffectivelyActive` (porté dans les
   pickers d'assignation, absent des tables de gestion) et pour la ligne « HH:mm Paris » (calculée
   par `displayPickup`, rendue nulle part).
2. **Elle a examiné les domaines séparément.** `/meta` filtré aux types actifs et la facturation ont
   été validés chacun de leur côté, sans croiser les deux — d'où une régression **créée** par une
   correction (colonne Category vide sur toute facture dont le type de véhicule a été désactivé).

### Corrigé le 2026-08-29

**Bugs métier** (données fausses, message faux, perte de données) :

| # | Écart | Correction |
|---|-------|-----------|
| B4 | Décocher « Sub-contracted » **laissait le partenaire attaché** (`partnerRef` omis du JSON, donc la garde `!== undefined` ne se déclenchait jamais) **et effaçait le tarif partenaire** — lu ensuite comme un changement de prix, d'où un 403 pour un DISPATCHER. | Le front dit le détachement (`partnerRef: ''`, comme `quickUpdateTrip`, common.js:2795) et renvoie toujours le tarif ; le serveur tient l'invariant « pas sous-traité ⇒ pas de partenaire ». |
| B5 | Course **ASD** : `dropoffLocation` nul, et les templates `onboard`/`dropped` l'interpolent sans repli → le POC recevait **« On the way to null »**. | Règle serveur : un ASD prend son PU comme DO (`syncDropoffFromPickup`, common.js:1478). Vaut pour create, update, assign et le bulk. |
| B6 | Le dialogue d'annulation s'ouvrait toujours sur « Free ». Le serveur lit FREE comme « aucun frais » et **supprime la course** : rouvrir une course annulée à 50 % et confirmer la détruisait. | Le frais est pré-chargé depuis la course (common.js:2483). |
| B7 | **Colonne « Category » vide** sur toute facture PDF/Excel dont le type de véhicule a été désactivé depuis — régression créée par la correction 5.2. | La facture porte le type avec lequel elle a été émise (`INVOICE_INCLUDE` joint `vehicleType`). |
| B8 | **Dérive de fuseau** : le front convertissait avec la timezone géocodée, le back stockait celle du pays. Divergentes dès qu'un pays en couvre plusieurs (Canaries, Açores) → heure affichée et heure annoncée au POC décalées. | `pickupTimezone` fait partie du DTO et est persisté ; repli sur la timezone du pays. |

**Règles legacy non portées, désormais portées :**

- Sélecteurs Partner / Client de la facturation : filtre métier en JS **après** pagination →
  `partnersOnly` sur `GET /drivers`, `excludeType` sur `GET /clients` (filtres Prisma).
- `isEffectivelyActive` dans les tables Drivers et Vehicles : grisage + badge nommant la cause
  (`packages/shared/src/business/effective-activity.js`).
- Ligne « HH:mm Paris » sous l'heure locale, partout où une course est listée.
- Ordre des dates d'événement (`eventEndDate >= eventStartDate`), acronyme ≤ 4 caractères,
  `phone` requis sur un compte d'accès, tarif partenaire requis pour sous-traiter, `tracking`
  forcé par le Create bulk.
- Colonnes Sub-C et Action de la liste Planning ; suppression définitive exposée dans l'UI.
- Recherche d'adresse (`geocode-search`), auto-remplissage du pays depuis le géocodage
  (`matchCountryByGeocode`), combobox POC (`poc-search`), verrou FBO/Tail sur un vol commercial,
  règle des 4 devises retail, `shortPlaceLabel` + n° de vol dans la colonne Itinéraire, email
  réservé aux partenaires, combobox des sociétés partenaires, crayon grisé sur un véhicule retiré.
- Bloc « Flight info » déclenché par « c'est un aéroport » et non par la présence d'un code IATA :
  le géocodeur reconnaît un aéroport plus souvent qu'il ne sait le nommer (JFK), et une prise en
  charge sans IATA n'avait **nulle part** où saisir son numéro de vol.

**Trou propre à v2, comblé :** aucun moyen de changer un mot de passe. v2 en impose un à la
création, la désactivation est à sens unique — un compte dont le mot de passe était perdu était
irrécupérable. `PATCH /users/:id/password` + l'action dans la table Users.

### Écarts assumés — décision de Romain, 2026-08-29

Identifiés, réels, **volontairement non corrigés**. Un écart écarté se documente ; il ne se tait pas.

| Écart | Legacy | v2 — conservé |
|-------|--------|---------------|
| **Indisponibilité** | type verrouillé et **non annulable**, dates modifiables (common.js:3611-3615) | dates figées + bouton « Clear » : on peut corriger une erreur de type, au prix d'une re-saisie pour déplacer une date |
| **Tri des listes** | actifs puis `ref` (server.js:1725, 1820, 1909, 252) | actifs puis `createdAt` |
| **Bornes de facturation** | classement sur la **date murale** du PU (invoicing.html:291) | instant ramené à minuit Paris — une course NY du 30/06 22:00 LT part sur la facture de juillet |
| **Recherche** | insensible aux accents dans tous les pickers (common.js:443) | ILIKE Postgres : « Herve » ne trouve pas « Hervé » |
| **Devises (7.1)** | Retail en devise retail, Partner en devise pays, stockés bruts | tout en EUR — le legacy additionnait des devises hétérogènes dans `totalHT` |
| **Popups d'édition rapide (6.6.2)** | cellules cliquables | non portées ; leur seule règle métier (`isBeforeArrival`) l'est |
| **Confirm de la popup vol** | Confirm bloqué tant que vol validé **ou** FBO + Tail(5) | non porté : cette popup avait un Cancel, donc la règle ne bloquait que sa propre validation, jamais la création. Inline, elle bloquerait la course elle-même — plus strict que le legacy |

### Deux tightenings assumés, introduits le 2026-08-29

- **Tarif partenaire requis pour sous-traiter** : le legacy l'exigeait dans la popup de
  sous-traitance (common.js:2812), pas dans la barre de création. v2 n'ayant qu'un formulaire, la
  règle s'applique aussi à la création.
- **Colonne Itinéraire** : `shortPlaceLabel` fait précéder l'adresse de la ville du fuseau quand
  l'adresse ne la nomme pas. Sur une adresse saisie à la main en un seul segment (« Nice Airport »
  sur une course en fuseau Paris) cela donne « Paris, Nice Airport ». C'est le comportement legacy —
  qui supposait des adresses issues de son autocomplétion. Celle-ci étant rétablie, les nouvelles
  courses portent des adresses complètes.

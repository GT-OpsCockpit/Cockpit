# Plan — écarts legacy retenus par Romain (2026-08-30)

Suite du relevé `2026-08-30-qa-sweep-legacy-gaps.md`. Les 33 écarts restants ont été passés en
revue un par un ; ce document ne garde que **ceux que Romain a retenus**, avec ce qu'il faut faire,
où, et dans quel ordre.

**17 écarts retenus.** Un dix-huitième — la notification POC au drag & drop du Planning — a été
retiré du plan : la vérification en direct a montré qu'il **n'existe pas** (voir le relevé,
§`/planning`).

Contexte qui simplifie tout : **le legacy n'a jamais été mis en production**. Il n'y a donc aucune
donnée réelle à migrer — seulement la base de dev, dont les enregistrements bancals sont des restes
de sessions de test manuelles.

## Décisions arrêtées avant implémentation (2026-08-30, session /grill-me)

Chaque point ouvert du plan a été passé en revue avec Romain avant d'écrire une ligne. Ce qui suit
remplace le plan là où les deux divergent.

**Faits qui contredisent le plan, vérifiés dans le code :**

| Le plan dit | Le code dit |
|---|---|
| Ajouter `<Tooltip>` shadcn (2.1) | Il existe déjà — `components/ui/tooltip.tsx` |
| Code pays seul, « les emoji rendent mal » (1.1) | `CountryFlag` est un sprite CSS, pas un emoji ; `CountryLabel` est la convention de `/vehicles` |
| `NAV_ITEMS` alimente les `<PageTitle>` (5) | Il n'en fournissait que l'**icône** ; les `<h1>` étaient en dur |
| Vérifier les Playwright qui naviguent par `getByRole('link')` (5) | Aucun — tous font `page.goto()` |
| 6.2 « purement de la cohérence » | `<FormMessage/>` exige `useFormContext` : conversion react-hook-form complète |
| Supprimer `MAN`/`UBE` (3.1) | `RAC-001` est sous-traitant de `R-CE5-26-2`, `MAN-001` détient `F4` |
| 3.1 « effort faible » | **33 créations de chauffeurs** cassées dans 5 specs API, plus Playwright |
| `PATCH /drivers/:ref` (8) | C'est un `PUT`, et `update()` valide le DTO **brut**, non fusionné |
| `outsideEventWindowFilter` « utilisé nulle part » (8) | Utilisé par `ClientsService.listReactivationCandidates()` |
| **`offerEventReactivation` non portée** (Lot 8, §4.4 de l'audit) | **Portée le 28/08** — commit `408f5ff`, avec ses tests. Voir plus bas |

**Décisions, lot par lot :**

- **1** — `CountryLabel` réutilisé tel quel (drapeau + nom + code). Colonnes insérées sans déplacer
  les existantes : `Ref | Country | Name | Type | Email | POC | POC phone | Billing | Action`.
  Dates d'événement en ligne grise 10px sous le nom, via `formatDate`.
- **2** — Tooltip POC dès que le POC diffère du passager. Auto-synchro POC limitée aux comptes
  **Individual**, seuls à porter `contactFirstName`/`contactLastName`.
- **3** — Base d'abord : `D-FR-INT-003` → `FR` ; `D-XX-XX-RAC-001` → `FR/Cannes` + relien sur `CE5`
  (aujourd'hui inéditable : `eventCountry=MC` avec `countryCode=NULL`) ; `UBE-001` supprimé ;
  `MAN-001` supprimé après avoir délié `F4`. Le churn de tests est absorbé par un helper dans
  `apps/api/test/utils/`. Email activé si `eventsOnly || isPartner`, **et** vidage automatique
  conditionné à `!eventsOnly`. `<FormMessage/>` ajouté sous le champ Country, absent aujourd'hui.
- **4** — Purge de l'OTP au 5ᵉ échec, 429 « please log in again » sur cet appel, 400 générique
  ensuite. `CredentialsForm` masqué au lieu d'être démonté : le mot de passe ne sort pas de son
  composant.
- **5** — Nav **et** `<h1>` renommés ; les sous-tables « Drivers » / « Partners » ne bougent pas.
  `<PageTitle>` dérive désormais son libellé de `NAV_ITEMS` comme il dérivait déjà son icône.
- **6** — Une migration SQL manuelle : colonne, backfill par `role` + `createdAt` (désactivés
  compris), `NOT NULL` + `UNIQUE`, et amorçage de `RefCounter` (`user:O`, `user:D`). Le ref ne suit
  pas un changement de rôle — déjà tranché par `server.js:786`, pas rouvert. `UserPasswordDialog`
  converti en react-hook-form + zod.
- **7** — `acronym ?? regNbr ?? '—'`, et la phrase du bulk réécrite pour dire l'ASD 4 h.
- **8** — **Sans objet : la feature existe.** `EventReactivationDialog`, `GET
  /clients/:ref/reactivation-candidates` et `POST /clients/:ref/reactivate` sont en place depuis le
  commit `408f5ff` (28/08), montés sur `/clients` **et** `/events`, tout coché par défaut, candidats
  désactivés exclus, rattachement transactionnel. Couverts par `clients.e2e-spec.ts` et
  `event-reactivation-dialog.test.tsx`. Ce qui reste vraiment à faire : corriger la §4.4 de
  `docs/LEGACY_PARITY_AUDIT.md` et le relevé QA, qui la déclarent tous deux non portée.

**Ordre retenu** : `4,5,7` → `1,2` → `3.1+fixtures` puis `3.2+3.3` → `6.1` → `6.2`. Un commit par
étape, direct sur `main`, les 7 suites du §7.3 vertes avant de clore chacune.

## Ce qui a été écarté

Pour mémoire, et pour ne pas le re-proposer : popups d'édition rapide des 6 cellules, `Area` non
obligatoire, résumé « Flight info », `Buffer` `step=5`, icône 📤 du badge, validation live de
l'acronyme, tri par `ref`, format de référence `D•FR•INT•1`, libellé « Remove from fleet », bouton
« Correct » de la facturation, bornes de facturation, porte mot de passe Owner, `Password`
obligatoire à la création, devise legacy, format de date ISO des pages publiques, mention
« via Twilio », `Settings → Owner`.

## Lot 1 — les colonnes de liste perdues (4 écarts, effort faible)

Un seul lot : c'est le même geste répété, et c'est ce qui rend le pays et le POC de nouveau
lisibles sans ouvrir chaque fiche.

| # | Écart | Où |
|---|---|---|
| 1.1 | Colonne **Country** sur `/clients` | `clients-table.tsx` — `countryCode` est déjà dans la réponse |
| 1.2 | Colonne **POC** (le nom, à côté du téléphone) sur `/clients` | idem, `pocName` déjà renvoyé |
| 1.3 | **Dates de l'événement** sous le nom d'un compte Events | idem, `eventStartDate`/`eventEndDate` déjà renvoyés |
| 1.4 | Colonne **Country** sur `/drivers` | `drivers-table.tsx` |

Détails : le legacy affiche le pays avec son drapeau (`common.js:3369` et `:3531`). Décider une
fois pour toutes si v2 met un drapeau ou le seul code — je propose le **code seul** (`FR`), les
drapeaux emoji ne rendent pas de la même façon d'un poste à l'autre et la colonne doit rester
étroite. Les dates d'événement vont dans la **même cellule** que le nom, en gris, comme le legacy
(`common.js:3358-3360`).

Tests : les tables ont déjà leurs specs (`bookings-table.test.tsx` sert de modèle). Un cas par
colonne, plus le cas « pas de pays » / « pas de POC » / « compte non-Events ».

## Lot 2 — le POC là où on le cherche (2 écarts)

| # | Écart | Où |
|---|---|---|
| 2.1 | **Tooltip POC** sur la ligne de `/bookings` | `bookings-table.tsx`, cellule passager |
| 2.2 | **Auto-synchro « POC Full Name »** dans le formulaire client | `client-form-fields.tsx` |

2.1 — le legacy affiche au survol `POC: <nom> · <téléphone international>` **dès que le POC diffère
du passager** (`common.js:3108`). Utiliser le `<Tooltip>` shadcn (à ajouter s'il n'est pas encore
dans `components/ui`), pas un `title` natif : le délai du navigateur est trop long pour un usage
d'urgence. Condition d'affichage à reprendre telle quelle — pas de tooltip quand le POC *est* le
passager, sinon c'est du bruit sur toutes les lignes.

2.2 — le champ POC se remplit depuis Prénom + Nom **tant que l'utilisateur n'y a pas touché**
(`pocNameAutoSynced`, `clients.html:470-498`). Le serveur fait déjà le repli, donc c'est du confort
de saisie pur : l'utilisateur voit ce qui sera enregistré. Le drapeau « touché » est la seule
subtilité — une fois le champ édité à la main, il ne se re-synchronise plus.

## Lot 3 — `/drivers` : ce que la fiche exige et ce qu'elle montre (3 écarts)

| # | Écart | Où |
|---|---|---|
| 3.1 | **Country obligatoire**, création **et** édition | `packages/shared/src/business/record-requirements.js` — la règle est partagée API + web, un seul endroit |
| 3.2 | Colonne **Company / « In-house »** | `drivers-table.tsx` |
| 3.3 | **Email requis sous un champ grisé** | `driver-form-fields.tsx:36` et `:159` |

3.1 — décision de Romain : **requis partout**, comme le legacy. Le champ reste `nullable` en base
(aucune migration), c'est la validation qui l'exige. Quatre chauffeurs de la base de dev n'ont pas
de pays : `D-FR-INT-003` (Léa Fontaine), `D-XX-XX-MAN-001`, `D-XX-XX-RAC-001`, `D-XX-XX-UBE-001`.
Aucun ne vient du seed (`seed-data.ts` n'en crée que trois, tous avec un pays) : ce sont des restes
de tests manuels. À traiter avant de poser la règle, sinon leurs fiches deviennent inéditables —
et je ne leur invente pas de pays. Deux d'entre eux (`MAN`, `UBE`) sont par ailleurs les
« sociétés sans personne nommée » qui ont produit les bugs #13 et #15 ; leur suppression pure et
simple est probablement la bonne réponse. **À confirmer avec Romain au moment de faire.**

3.2 — le legacy écrit « In-house » pour un interne et la société pour un partenaire
(`common.js:3531`). v2 met déjà la société entre parenthèses dans la cellule Nom mais n'écrit rien
pour un interne. Le plus simple est de compléter cette cellule, pas d'ajouter une colonne.

3.3 — cocher « Events-only » sans Company affiche « Email is required for an Events driver » sous
un champ **désactivé** (l'email ne s'active qu'avec une société). Le legacy a le même piège
(`drivers.html:385`). Deux sorties : activer l'email dès que « Events-only » est coché (la règle
métier l'exige de toute façon), ou n'afficher son message qu'une fois Company rempli. **Je
recommande la première** : c'est le champ qui a tort d'être grisé, pas le message d'avoir raison.

## Lot 4 — `/login` (2 écarts, effort très faible)

| # | Écart | Où |
|---|---|---|
| 4.1 | Purger le code OTP au 5ᵉ essai raté | `auth.service.ts:100-107` |
| 4.2 | « Back » conserve email et mot de passe | `login-page.tsx:60-90` |

4.1 — v2 renvoie 429 mais laisse le code vivre jusqu'à son expiration ; le legacy le supprime et dit
« please log in again ». Sans conséquence exploitable, mais autant ne pas laisser traîner un code
mort en base. Un `delete` sur le `OtpCode`, et le message aligné.

4.2 — `CredentialsForm` est **démonté** quand on passe à l'étape OTP, donc son état est perdu et
« Back » ramène un formulaire vide. Remonter l'email et le mot de passe dans l'état de `LoginPage`
(le `Step` porte déjà l'email) et les réinjecter en `defaultValues`.

## Lot 5 — libellés de navigation (1 écart, effort trivial)

`nav-items.ts` : `Clients` → **`Customers`**, `Drivers` → **`Drivers & Partners`**. Le lien
`Planning` unique et le libellé `Settings` sont conservés (décisions actées). Attention : `NAV_ITEMS`
alimente aussi le `<PageTitle>` de chaque page — vérifier que les titres suivent, et que les specs
Playwright qui naviguent par `getByRole('link', { name: 'Clients' })` sont mises à jour. Un `grep`
sur les deux libellés avant de committer.

## Lot 6 — `/settings` (2 écarts)

| # | Écart | Où |
|---|---|---|
| 6.1 | **Référence lisible d'un compte** (`O-001` / `D-001`) | `User.ref` + `RefCounter` + `users-table.tsx:49` |
| 6.2 | Message du dialogue mot de passe en `<FormMessage/>` | `user-password-dialog.tsx` |

6.1 — décision de Romain : **rouvrir la §1.4 de l'audit** et redonner une vraie référence, plutôt
que retirer la colonne. Le legacy attribue `O-001`, `O-002`… à un Admin et `D-001`, `D-002`… à un
Dispatch (`server.js:788-801`), séries indépendantes, zero-pad 3. Le mécanisme existe déjà en v2 :
`RefCounter` + le service qui l'utilise pour les courses. Il faut : une colonne `ref` unique sur
`User`, sa génération à la création, une migration Prisma donnant une référence aux comptes en
place, et la colonne du tableau qui l'affiche à la place de `user.id.slice(0, 8)`.
Deux questions à trancher **au moment de faire** : (a) la référence suit-elle un changement de rôle
(le legacy ne la change jamais — je propose de garder la référence d'origine) ; (b) l'ordre
d'attribution aux 6 comptes existants (par `createdAt`, le plus naturel).
Penser à mettre à jour `docs/LEGACY_PARITY_AUDIT.md` §1.4, qui deviendra faux.

6.2 — le dialogue rend son erreur dans un `<p class="text-destructive">` maison alors que tous les
autres formulaires passent par `<FormMessage/>`. Purement de la cohérence.

## Lot 7 — deux textes qui mentent (2 écarts, effort trivial)

| # | Écart | Où |
|---|---|---|
| 7.1 | Colonne **Reg Nbr** de `/bookings` | `bookings-table.tsx:103` |
| 7.2 | Texte du dialogue **Create bulk** | `bulk-dates-dialog.tsx` |

7.1 — la colonne affiche l'**acronyme** du véhicule et « — » quand il n'en a pas, ce qui est
indistinguable de « aucun véhicule assigné ». Vu en live sur `AA-001-BC`, assigné et pourtant
affiché « — ». Le legacy fait pareil et l'assume (`common.js:2604-2611`), donc ce n'est pas une
régression : c'est une colonne qui ment des deux côtés. Repli sur le `regNbr` quand l'acronyme
manque.

7.2 — le dialogue annonce « the last day is left with no drop-off ». En réalité le dernier jour
devient une course **ASD 4 h** et le serveur recopie le point de départ en destination, pour éviter
un « On the way to null » dans le WhatsApp (`booking-fields.ts:240-248`). Le texte est un portage
verbatim d'un texte legacy déjà imprécis. Une phrase à réécrire.

## Lot 8 — `offerEventReactivation` (1 écart, le gros morceau)

Le seul lot qui ne soit pas du rattrapage d'affichage, et **la feature manquante la plus coûteuse à
laisser tomber**. Décision de Romain : on la porte, ce qui rouvre la §4.4 🟡 de l'audit.

**Ce qu'elle fait** (`common.js:3905-3980`, déclenchée depuis `clients.html:532`) : juste après la
création d'un compte Events, elle propose de **relier au nouvel événement** les chauffeurs et
véhicules `eventsOnly` qui servaient un événement précédent au **même pays + même area** et sont
aujourd'hui dormants. Cases à cocher, boutons « Skip » et « Reactivate selected ».

**Pourquoi ça compte** : sans elle, un événement récurrent impose de rouvrir une par une la fiche de
chaque chauffeur et de chaque véhicule de l'édition précédente. Le coût est proportionnel à la
taille de l'équipe et tombe la veille de l'événement.

**Ce qui existe déjà côté v2, et qu'il ne faut surtout pas réécrire** :

- `outsideEventWindowFilter(today)` dans `apps/api/src/common/business/assignability.ts:56-69` —
  écrit exactement pour ça (son commentaire cite `common.js:3912`) et **utilisé nulle part** ;
- `EventLinkService.resolveEventClientId()`, qui valide déjà qu'un enregistrement peut être relié à
  un événement donné (mêmes pays/area, événement non terminé) ;
- les filtres `eventCountry` / `eventArea` / `eventNotEnded` sur `GET /clients`, et leurs
  équivalents côté drivers/fleet.

**Découpe proposée** :

1. **API** — un endpoint de lecture qui liste les candidats : chauffeurs et véhicules `eventsOnly`,
   dormants (`outsideEventWindowFilter`), dont `eventCountry`/`eventArea` correspondent à ceux du
   compte Events visé. Une seule route qui renvoie les deux familles, ou deux paramètres sur les
   listes existantes — à voir en écrivant, la deuxième est probablement plus dans le style du dépôt.
2. **API** — le rattachement lui-même. Le legacy fait un `PATCH` par enregistrement retenu ; en v2
   les endpoints `PATCH /drivers/:ref` et `PATCH /fleet-vehicles/:ref` existent déjà et passent par
   `EventLinkService`. **Ne rien ajouter côté écriture** si ces deux-là suffisent : le front boucle.
3. **Web** — le dialogue, ouvert après la création d'un compte Events, sur `/clients` **et** sur
   `/events` (les deux points d'entrée). Liste à cases, « Skip » / « Reactivate selected », état
   vide honnête quand il n'y a aucun candidat (ne pas ouvrir le dialogue du tout dans ce cas, comme
   le legacy).
4. **Tests** — un e2e Playwright qui rejoue le scénario complet : un événement passé avec son
   équipe, un nouvel événement au même endroit, le dialogue qui propose la bonne équipe, et les
   fiches effectivement reliées. Plus des tests unitaires sur le filtre de candidature (dont le cas
   « même area, mais événement encore en cours » → pas dormant, donc pas proposé).
5. **Doc** — mettre à jour `docs/LEGACY_PARITY_AUDIT.md` §4.4, qui la déclare non portée.

**Vérification manuelle attendue** : le scénario a déjà été joué à la main pendant la passe QA avec
la relance manuelle (étendre les dates de l'événement remet chauffeur et véhicule dans les
sélecteurs). C'est le comportement de référence : après « Reactivate selected », les enregistrements
doivent apparaître dans les sélecteurs d'assignation exactement comme ils le font aujourd'hui après
une relance manuelle.

## Ordre d'exécution proposé

1. **Lots 4, 5, 7** — trivialement petits, aucun risque, ils dégagent le terrain (5 écarts).
2. **Lots 1 et 2** — les colonnes et le tooltip : même famille, même fichier pour trois d'entre
   eux (6 écarts).
3. **Lot 3** — `/drivers`, parce que 3.1 demande de trancher le sort des 4 fiches sans pays avant de
   poser la règle (3 écarts).
4. **Lot 6** — `/settings`, dont 6.1 porte une migration (2 écarts).
5. **Lot 8** — `offerEventReactivation`, seul, en dernier (1 écart).

Règles de la maison qui s'appliquent à tout : rouge d'abord sur chaque test écrit ou modifié
(marqueur vérifié), pas de Prettier sur `apps/web`, commits directs sur `main`, un par lot cohérent,
et les 7 suites du §7.3 vertes avant de considérer un lot fini.

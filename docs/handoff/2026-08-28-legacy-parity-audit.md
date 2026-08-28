# Handoff — 2026-08-28 — Audit de parité métier legacy ↔ v2 + correction des 6 bugs trouvés

## Ce qui a été demandé

« On approche de la fin de la réécriture. Compare minutieusement le legacy et ce qu'on a implémenté.
Assure-moi qu'il n'y a AUCUN changement métier. Changement de visuel pas grave MAIS pas de changement
de logique de calcul ou de façon de faire. Si il y en a, tu les listes. Feature par feature, modèle par
modèle, je veux un vrai listing. » — puis « enchaîne » pour appliquer les corrections.

## Méthode

Lecture **intégrale** du legacy (`~/Téléchargements/Cockpit/Cockpit/suivi-chauffeur-twilio`) :
`server.js` (2736 l.), `public/common.js` (4474 l.), les 14 pages `public/*.html`. Confrontée à
`apps/api/src/**`, `apps/api/prisma/schema.prisma` et `apps/web/src/features/**`.

Pas de sous-agent : la comparaison exige de tenir le legacy et le v2 en tête simultanément.

## Livrable

**`docs/LEGACY_PARITY_AUDIT.md`** — le listing complet, 13 sections, chaque point classé
🔴 régression / 🟠 changement réel / 🟡 règle non portée / 🔵 modernisation / ✅ conforme,
avec les références de fichier/ligne des deux côtés. C'est le document à lire, pas ce handoff.

## Verdict

Le cœur métier est fidèle. Notamment vérifiés ligne à ligne et conformes : toutes les validations
de création/édition de course, la génération et la libération des refs `R-{client}-{YY}-{seq}`
(réutilisation du plus petit slot libéré incluse), le pipeline de statut complet et ses blocages,
le verrou sous-traitance, l'arbre de validation conditionnel des chauffeurs, la chaîne complète de
validation flotte, le « Create bulk » Events, le moteur de timeline Gantt, les filtres de facturation,
les pages publiques, et **tous les catalogues au nombre d'entrées près** (210 pays, 391 villes,
modèles/couleurs/compatibilités, les 7 templates WhatsApp repris verbatim).

## Les 6 bugs corrigés cette session

| # | Fichier(s) | Correction |
|---|-----------|------------|
| B1 | `trips/dto/list-trips-query.dto.ts`, `trips/trips.service.ts`, `web/.../bookings-page.tsx` | La fenêtre « passé + assigné → masqué » devient le paramètre opt-in `board=true`, envoyé par la seule page Bookings. Elle était inconditionnelle, y compris pour `period=all` — **Invoicing ne voyait plus une seule course facturable**, Events/Partner log/Planning perdaient leur historique. Dans le legacy (`baseVisibility`, `dispatcher.html:349-363`) c'était une règle d'affichage de `dispatcher.html` **et de rien d'autre**. |
| B2 | `trips/trip-message.util.ts` (+ nouveau `.spec.ts`) | Lecture de `pickupAt` dans `trip.timezone` via Luxon au lieu des getters UTC. Un commentaire affirmait un stockage « naïf » ; c'est faux, `toPickupAt` (front) convertit wall-clock+tz → UTC. Tous les WhatsApp annonçaient l'heure **en UTC** en écrivant « (local time) » (PU Paris 14:00 été → « at 12:00 »). |
| B3 | `company/company.service.ts`, `web/.../company-tab.tsx`, `company-form-mapping.ts` | 409 « locked after the first save » retiré. `saved` redevient « déjà renseignée une fois » et pilote une vue lecture seule + crayon + Cancel côté Settings — exactement le flux legacy (`owner.html:269-280`, crayon + mot de passe Owner, réédite autant de fois que voulu). ⚠️ Contredit sciemment l'entrée journal Settings du 2026-08-27 qui l'avait noté « gap accepté ». |
| B4 | `trips/trips.service.ts` (`update()` **et** `assign()`) | `dispatched` repasse à `false` sur **toute** sauvegarde, pas seulement sur réassignation (`server.js:2470`). Sinon changer une date/un lieu/un véhicule ne réarme plus le bouton Send et le chauffeur garde l'ancienne info. Les `steps`, elles, ne sont effacées que sur changement d'assigné — règle legacy inchangée. |
| B5 | `meta/meta.service.ts` (+ e2e) | `/meta` ne renvoie plus que les types de véhicule actifs. La colonne `active` a été ajoutée par v2 (le legacy n'avait ni update ni delete sur les types) mais `/meta` l'ignorait — un type désactivé restait proposé dans la barre de réservation. La page de gestion garde son endpoint non filtré. |
| B6 | `auth/dto/login.dto.ts`, `verify.dto.ts`, `users/users.service.ts`, `prisma/seed-data.ts` | Emails normalisés (trim+lowercase) à la lecture **et** à l'écriture, via le `normalizeEmail` déjà partagé avec `ClientsService`. Le legacy comparait en minuscules (`server.js:131`) ; v2 faisait un `findUnique` exact, donc `Admin@x.com` échouait sur un compte `admin@x.com`. |

## Vérification

- `pnpm exec tsc --noEmit` OK sur `apps/api` et `apps/web` (`-p tsconfig.app.json`).
- API : 36 tests unitaires + **119 e2e** verts. Web : 267 tests verts. `eslint` OK sur `apps/api`.
- Le test de B2 a été **vérifié en rouge** (ancienne implémentation réinjectée temporairement :
  2 échecs) avant d'être vert — il attrape bien la régression.
- Tests e2e mis à jour parce qu'ils figeaient le comportement corrigé : le lock company (409→200),
  `does not reset dispatched on a PUT…` (→ `resets dispatched…`), `reassigning the fleet vehicle
  alone does not reset dispatched` (→ `…resets dispatched but keeps the steps`), et le test de
  visibilité `period=all` scindé en deux (avec/sans `board`).
- Vérification navigateur sur la stack docker : `/settings` (crayon → formulaire pré-rempli →
  Save → retour lecture seule + toast), `/bookings` envoie bien `?period=upcoming&board=true`,
  `/invoicing` envoie bien `?period=all` sans `board`, console sans erreur nouvelle.
- Vérification API en direct : course passée assignée visible sans `board`, masquée avec ;
  message de dispatch loggé « at 12:11 (local time) » pour un `pickupAt` 10:11Z en `Europe/Paris` ;
  `dispatched: false` après une édition de PU sans réassignation ; 2ᵉ `PUT /company-info` → 200.

## Ce qui reste ouvert (choix produit, pas des bugs)

Détaillé en §14 de l'audit. Les plus lourds :

1. **`driverEligibleForTrip` et `isEffectivelyActive` non portés.** Congés / arrêt maladie / jour off /
   garage / fenêtre d'événement se saisissent et s'affichent, mais **ne filtrent plus rien** à
   l'assignation, et les règles d'éligibilité (chauffeur Events → courses Events seulement ;
   chauffeur interne → daily + Events si local ; partenaire → daily seulement) ont disparu.
   C'est le plus gros écart fonctionnel restant.
2. **Calcul de marge supprimé** (FR `(retail−partenaire)/retail`, étranger `((retail/1.1)−partenaire)/(retail/1.1)`)
   et **sémantique de devise inversée** sur les tarifs (legacy : saisie en devise locale, stockage brut ;
   v2 : saisie en EUR). C'est une correction du bug legacy, mais elle change ce que valent les
   nombres stockés et les totaux de facture.
3. Auto-assignation du véhicule réservé au chauffeur, champ Area redevenu texte libre (le legacy le
   contraignait aux villes du pays, « Local » réservé à la France — et `area` alimente le split
   Local/Farm-out **et** l'éligibilité chauffeur), brouillons d'email de sous-traitance,
   pré-remplissage FBO (endpoint présent, jamais appelé), champ texte nameboard,
   `offerEventReactivation`, endpoints `DELETE` définitifs non protégés par une permission.

## Points d'attention pour la session suivante

- **Rien n'a été commité** : l'arbre de travail contenait déjà beaucoup de travail non commité
  d'une session antérieure (refonte UI, endpoints de recherche). Committer aurait tout ramassé.
- **Donnée de dev abîmée par erreur** : en testant B3 j'ai écrasé la fiche société de la base de dev
  avec un payload de test. Seuls `name` (« Cockpit Transport ») et `city` (« Paris ») ont pu être
  restaurés — les 11 autres champs portent « À RESAISIR » et sont à ressaisir dans Settings.
  Leçon : lire l'enregistrement **en entier** avant de le remplacer par un payload de test.
- Le client orval a été régénéré (`pnpm --filter @cockpit/web api:generate`) pour exposer `board` —
  refaire après toute modif de DTO.

---

# 2ᵉ passe (même jour) — portage des règles legacy manquantes

## Recadrage

L'utilisateur a rejeté le classement « choix produit » de la §14 : *« je ne comprends pas pourquoi
ce sont des choix produit si le legacy avait déjà ces règles »*. Il avait raison — j'avais séparé
« bug » et « choix produit » sur un critère d'effort d'implémentation, alors que sa consigne portait
sur la nature de l'écart. Une règle présente au legacy et absente de v2 est une régression, point.
Consigne associée : **un maximum de règles dans le backend**.

## Porté

| Règle | Où | Note |
|---|---|---|
| `driverEligibleForTrip` (8.1) | `api/src/common/business/assignability.ts` → `GET /drivers?tripClientRef=&tripArea=&tripCountryCode=&tripPickupLocation=&tripDropoffLocation=` | Le picker envoie le brouillon de course, comme `draftTripForEligibility()` au legacy. |
| `isEffectivelyActive` (8.2) | idem → `?availableOnly=true` sur drivers **et** fleet-vehicles | Deux builders distincts : un chauffeur porte soit une date unique (jour off) soit une plage, un véhicule seulement une plage. |
| Auto-assignation du véhicule réservé (8.3) | `TripsService.findReservedVehicle` | Un seul endroit couvre create / update / `assign` ; le legacy la dupliquait dans deux fonctions front. Ne se déclenche qu'à une vraie (ré)assignation, jamais par-dessus un Reg Nbr explicite. |
| Marge (7.2) + totaux ASD (7.3) | `packages/shared/src/business/pricing.js` | Pas un endpoint : indications recalculées à la frappe. |
| Filtres Reg Nbr (8.4), champ désactivé hors course locale (8.8) | web + `?compatibleWith=` | `isLocalTrip` extrait dans `packages/shared` — il sert au split Local/Farm-out (web), à l'éligibilité (api) et à ce champ. |
| Pré-remplissage FBO (8.6) | `LocationField` | L'endpoint existait, rien ne l'appelait. N'écrase jamais une adresse déjà saisie. |
| Champ texte `nameboard` (6.2.2) | migration `20260828144635_add_trip_nameboard_text` | Distinct de `nameboardUrl` (le fichier joint). |

**Pourquoi des filtres Prisma et pas des prédicats JS** : ces listes sont paginées. Filtrer la page
rendue côté front *masquerait* des chauffeurs au lieu de les exclure, et la pagination afficherait
des pages à trous.

**Cause racine, commune avec B1** : le refactor « plus rien sans pagination » du 27/08 a déplacé ces
listes côté serveur, et les règles métier qui y étaient accrochées n'ont pas toutes suivi. À vérifier
systématiquement lors de tout futur déplacement de données vers le serveur.

## Décision produit actée — devises

La sémantique legacy (Retail saisi en devise du pays, stocké brut dans un champ nommé `priceEur`)
**ne revient pas**. Elle additionnait euros, francs suisses et dollars dans un même `totalHT` : les
factures legacy sont fausses dès qu'un client a des courses hors zone euro. Mauvaise conception, pas
règle métier. Le `/1.1` de la formule de marge porte sur la TVA et non sur la devise, il vaut donc
inchangé en EUR.

## Vérification

- API : 131 e2e verts (12 nouveaux cette passe), 36 unitaires. Web : 274 tests (7 nouveaux sur la
  marge/ASD), `tsc` et `eslint` OK.
- Les 6 tests d'éligibilité/disponibilité ont été **vérifiés en rouge** (filtres court-circuités :
  6 échecs) avant d'être verts.
- Vérifié en direct sur l'API : un chauffeur mis en congé du jour disparaît de `?availableOnly=true`
  (7 → 5) et reste dans la liste non filtrée ; course daily → internes + partenaires, pas d'Events ;
  course Events non locale → Events seulement ; course Events à Monaco → Events + internes, jamais
  de partenaires.
- Navigateur : les pickers envoient bien `availableOnly=true` + le contexte de course, le champ
  Reg Nbr affiche « Local bookings only » et est désactivé sur un brouillon non local.

## À savoir pour la suite

- **Édition concurrente pendant la session** : `apps/web/src/features/bookings/trip-form-fields.tsx`
  a été remanié en parallèle (remplacement de `useOptionMemory` par un `loading` sur `SearchCombobox`)
  pendant que j'y travaillais. Les deux jeux de modifications coexistent et tout est vert, mais
  vérifier `git diff` sur ce fichier avant de committer.
- Le conteneur `api` n'a pas `apps/api/generated` bind-monté : après un changement de schéma Prisma,
  `docker compose exec -w /app/apps/api api npx prisma generate` puis `docker compose restart api`,
  sinon le spec OpenAPI (et donc orval) reste en retard.
- Toujours rien de commité, pour la même raison qu'en 1ʳᵉ passe.

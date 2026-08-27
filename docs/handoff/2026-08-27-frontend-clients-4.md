# Handoff — Cockpit v2, "plus rien sans pagination" (Clients/Drivers/FleetVehicles/Bookings)

> Suite de `2026-08-27-frontend-clients-3.md`. L'utilisateur a rejeté le compromis "pagination opt-in" de la session précédente (`GET /api/clients` sans `page`/`limit` renvoyait tout, pour le picker de Bookings) : **plus aucun endpoint de liste ne doit fonctionner sans borne**, avec le bon pattern par cas d'usage (pagination pour un tableau de gestion, request-on-demand pour un picker, fenêtre de dates côté serveur pour le tableau de bord live de Bookings).

**Session du** : 2026-08-27

## Décisions de cadrage (validées par l'utilisateur en cours de session)

1. **Pickers/dropdowns** (Customer/Driver/Partner/Reg Nbr dans le formulaire de course, filtres client/chauffeur de Bookings) : passent en **request-on-demand** (recherche distante débattue), pas en pagination — un combobox n'a pas besoin d'un tableau paginé, juste d'une recherche bornée.
2. **Tableau Bookings** (Local/Farm-out, live, refresh SSE) : **pas** de pagination classique (mauvais fit pour un tableau de bord opérationnel) — à la place, une **fenêtre de dates résolue côté serveur**, reproduisant exactement la règle `baseVisibility` qui existait déjà côté front (une course passée disparaît sauf si elle n'a toujours pas de chauffeur assigné).
3. **Logique dupliquée front/back** : l'utilisateur a explicitement demandé une seule source de vérité, côté back de préférence — appliqué à la fois à la validation email (session -3) et à la fenêtre de dates de Bookings (cette session).

## Ce qui a changé

### 1. Plus de mode "tout donner" nulle part

`ClientsService.list()` avait un mode "si `page`/`limit` sont omis, tout renvoyer" (ajouté en session -3 pour le picker de Bookings) — **supprimé**. `page`/`limit` ont maintenant des défauts (1/20) mais sont **toujours** appliqués, plafond dur à 100 (`@Max(100)` sur le DTO, testé par un 400 explicite). Même traitement neuf pour **Drivers** et **FleetVehicles** (jusque-là aucun des deux n'avait ni filtre ni pagination du tout) :
- `apps/api/src/drivers/dto/list-drivers-query.dto.ts` + `driver-list.entity.ts` — `search`/`includeInactive`/`page`/`limit`, recherche sur ref/prénom/nom/société/email/téléphone.
- `apps/api/src/fleet/dto/list-fleet-vehicles-query.dto.ts` + `fleet-vehicle-list.entity.ts` — `search`/`includeInactive`/`page`/`limit`, recherche sur ref/regNbr/make/model/acronym.
- Enveloppe paginée `{data, total, page, limit}` pour les trois — cassant pour tout consommateur qui traitait la réponse comme un tableau brut, corrigé partout (voir plus bas).

### 2. Bookings — fenêtre de dates côté serveur, logique dé-dupliquée

`TripsService.list(query: ListTripsQueryDto)` accepte maintenant `period` (`upcoming` par défaut, ou `today`/`week`/`past`/`all`) et applique, **inconditionnellement**, la même règle que l'ancien `baseVisibility()` front : une course dont le pickup est avant *aujourd'hui* (fuseau Paris) sort de la vue sauf si elle n'a toujours pas de chauffeur (`driverId: null`) — c'est le backlog "à traiter", pas du bruit. Les courses des comptes Events sont exclues sans condition (avant, filtré côté front aussi).

Calcul des dates avec **Luxon**, ajouté comme dépendance back (`apps/api/package.json`, même version que le front — `3.7.2`) — nécessaire pour reproduire exactement l'arithmétique de fuseau horaire Paris (DST-aware) qui existait déjà côté front, plutôt que de la ré-écrire à la main et risquer une divergence subtile.

**Front simplifié en conséquence** — `apps/web/src/features/bookings/trip-status.ts` : `isPastDay`, `periodMatches`, `baseVisibility`, `isEventClientTrip` **supprimées** (plus dupliquées, c'est le back qui décide maintenant). `applyBookingFilters()` ne fait plus que du filtrage léger sur un ensemble déjà borné par le serveur (recherche texte, client/chauffeur/véhicule/service exact) — ne trie plus non plus (le serveur trie par `pickupAt` ascendant, `applyBookingFilters` ne doit jamais réordonner). `bookings-page.tsx` passe `filters.period` à `useTripsControllerList({period})`.

### 3. Pickers convertis en request-on-demand

**`apps/web/src/lib/use-option-memory.ts`** (nouveau hook) — un combobox à recherche distante n'a jamais que la tranche courante (≤20 résultats) dans `options`. Si l'élément sélectionné sort de cette tranche après une nouvelle recherche, `SearchCombobox` afficherait le placeholder au lieu du libellé sélectionné (il dérive le libellé de `options.find(o => o.value === value)`). Ce hook mémorise tout élément déjà vu (résultats live + un `seed` optionnel — ex. le client déjà connu d'une course en édition) pour que le libellé sélectionné survive indéfiniment. Implémenté en `useState`+`useEffect` (pas une ref mutée pendant le render — testé, incompatible avec React Compiler que ce projet utilise, lint `react/refs` le confirme ; le lint `set-state-in-effect` qui reste est accepté et documenté en commentaire, c'est le pattern correct ici : on synchronise avec un système externe, une query react-query, pas avec un évènement qu'on contrôle).

- `trip-form-fields.tsx` — Customer/Driver/Partner/Reg Nbr : chacun a son propre texte de recherche débattu (300ms) + son propre appel `use*ControllerList({search, limit: 20})`. Reg Nbr est passé de `<Select>` (liste statique) à `<SearchCombobox>` (nécessaire, plus de liste complète à afficher d'un coup). Le composant accepte maintenant un prop `trip?: TripEntity | null` (optionnel — omis à la création) pour seeder `useOptionMemory` avec le client/chauffeur/partenaire/véhicule déjà connu de la course en édition, sans devoir attendre qu'une recherche les fasse réapparaître. `booking-edit-dialog.tsx` passe `trip={trip}` ; `booking-creation-bar.tsx` ne passe rien (pas de course existante).
- `booking-filters-bar.tsx` — filtres Client/Chauffeur : mêmes conversions. Ajout d'une option sentinelle `{value: '', label: 'All clients'}` (et "All drivers") toujours présente en tête de liste — un `<Select>` avait ce comportement gratuitement (item `ALL` cliquable), un `SearchCombobox` n'a pas d'affordance native pour revenir à "aucun filtre", donc explicite maintenant.

**Ce qui n'a délibérément pas changé** : `useMetaControllerGetMeta()` (pays, types de véhicule, marques/modèles) reste un fetch complet — c'est de la donnée de référence bornée (constantes codées en dur côté back, jamais créée par un utilisateur), pas une entité qui grossit sans limite. Pas le même problème.

## Bug préexistant corrigé au passage

`apps/api/Dockerfile` et `apps/web/Dockerfile` ne copiaient `patches/` avant `pnpm install --frozen-lockfile` — cassait tout rebuild depuis que `pnpm-lock.yaml` référence un patch (ajouté en session Bookings antérieure). Découvert en re-buildant l'image api pour la dépendance `luxon`. `COPY patches patches` ajouté aux 3 endroits concernés (base api, prod api, base web).

## Tests

- **Backend** : nouveaux cas e2e pour Drivers (`drivers.e2e-spec.ts` — recherche/pagination/`includeInactive`/limite à 100) et FleetVehicles (`fleet.e2e-spec.ts`, même couverture), plus Clients (`clients.e2e-spec.ts` — cas limite-101). `trips.e2e-spec.ts` — nouveau describe "GET /api/trips — server-side date-window filtering" : défaut `period=upcoming` cache le passé, `period=all` cache quand même une course passée+assignée mais garde une passée+non-assignée, exclusion Events inconditionnelle, `period` invalide → 400. `invoices.e2e-spec.ts` corrigé (un fixture de date figée tombait dans le passé par rapport à "aujourd'hui" — `?period=all` ajouté à l'unique assertion concernée, pas de sens de changer la fixture pour ça).
- **Frontend** : `use-option-memory.test.tsx` (nouveau, 4 cas — passthrough, persistance après disparition, seed avant tout résultat live, un résultat live rafraîchit un libellé périmé). `trip-status.test.ts` réduit (4 fonctions supprimées, `applyBookingFilters` retesté sans le volet date/Events, plus un test "ne réordonne jamais" à la place du tri).
- **Playwright** : suite complète (9 specs) rejouée après chaque étape contre les images Docker rebuild — `booking-lifecycle.spec.ts` (Customer/Driver/Reg Nbr via recherche distante réelle), `trip-edit-rbac.spec.ts` (edit dialog pré-rempli — confirme le seeding `useOptionMemory`), `farm-out-subcontractor.spec.ts` (recherche Partner + fix de l'enveloppe `/api/drivers`), tous verts.

## Résultats finaux

- `pnpm --filter @cockpit/api test` → **27/27**
- `pnpm --filter @cockpit/api test:e2e` → **101/101**
- `pnpm --filter @cockpit/api exec tsc --noEmit` → propre
- `pnpm --filter @cockpit/web test` → **94/94**
- `pnpm --filter @cockpit/web exec tsc --noEmit -p tsconfig.app.json` → propre
- `pnpm --filter @cockpit/web lint` → 6 warnings (5 pré-existants + 1 nouveau documenté, `set-state-in-effect` sur `use-option-memory.ts`, expliqué dans son propre commentaire)
- `pnpm --filter @cockpit/web exec playwright test` → **9/9**, contre les images Docker rebuild (api + web)

## Environnement pour reprendre

`docker compose up --build api web` exécuté plusieurs fois — images à jour avec tout ce qui précède. Migration Prisma inchangée depuis la session -3 (rien de nouveau côté schéma cette fois, seulement des query params/DTOs).

**Prochaine étape suggérée** : aucune n'est bloquante. Si une page de gestion Drivers/Vehicles est construite plus tard, reprendre exactement le pattern de `/clients` (déjà posé : `ClientsPagination`, filtres débattus, `keepPreviousData`) plutôt que de le réinventer.

# Handoff — Cockpit v2, verticale `/planning` (Gantt drag&drop + vue liste)

> Suite de `2026-08-27-frontend-vehicles.md`, qui suggérait `/planning` comme prochaine étape — première verticale à dépendre des trois verticales de gestion (Clients/Drivers/Vehicles) déjà terminées, puisqu'elle assigne des chauffeurs et véhicules aux courses.

**Session du** : 2026-08-27

## Décision de cadrage

Un plan a été soumis et validé avant l'implémentation (trois questions posées à l'utilisateur : endpoint de réassignation, portée des courses Event, borne de l'effectif du Gantt). Décisions actées :
1. **`PATCH /api/trips/:ref/assign`**, nouvel endpoint léger côté back, plutôt que reconstruire un payload complet côté front (ce qu'aurait fait le portage naïf du `quickUpdateTrip` legacy, qui reconstruit un payload PUT complet depuis le trip courant + overrides — exactement le genre de mauvais pattern d'implémentation que ce projet a déjà décidé de ne pas reproduire).
2. **Courses Event incluses dès cette passe** : `GET /api/trips` gagne un paramètre `category` (`daily` par défaut/inchangé pour Bookings, `event`, `all`), assouplissant le filtre `clientType != EVENT` jusque-là inconditionnel.
3. **Effectif du Gantt** : `useDriversControllerList`/`useFleetVehiclesControllerList` avec `limit=100` (le plafond backend réel — voir bug ci-dessous), pas de nouvel endpoint non paginé.
4. **Gantt codé à la main**, pas de lib tierce (dhtmlx-gantt/frappe-gantt/etc.) — le Gantt legacy (`common.js:2097-2344`) est un cas simple (positionnement en %, drag&drop HTML5 natif, pas de zoom/resize/dépendances), une vraie lib de Gantt aurait été plus de travail à plier à cet usage qu'à porter directement.
5. **Une seule page** `/planning` avec toggle Chauffeurs/Véhicules (déjà acté dans `FRONTEND_PLAN.md`), pas deux routes séparées comme le legacy (`planning-chauffeur.html`/`planning-vehicules.html`).

## Ce qui a changé

### 1. Back — `apps/api/src/trips/`

- `dto/list-trips-query.dto.ts` : nouveau `category?: 'daily' | 'event' | 'all'` (défaut `'daily'` résolu dans le service — **comportement inchangé pour Bookings**, qui n'envoie jamais ce param).
- `trips.service.ts` `list()` : le filtre `clientType != EVENT` devient conditionnel sur `category` au lieu d'inconditionnel. La règle "un trip non-assigné ne sort jamais de la vue" reste inchangée, appliquée aux deux catégories.
- Nouveau `dto/assign-trip.dto.ts` (`AssignTripDto { driverRef?; fleetRegNbr?; }`) + `TripsService.assign()` + `TripsController.assign()` (`PATCH :ref/assign`) : patch minimal, volontairement indépendant du gros `update()` (pas d'extraction risquée). Gate `trip:edit-past` réutilisé tel quel (pas de nouvelle permission). Reset `dispatched`/steps/`assignmentCancelled` **seulement si le chauffeur change réellement** — une réassignation véhicule seule ne touche pas au statut, fidèle au legacy où `quickUpdateTrip` sur le Gantt Véhicules ne casse jamais le pipeline de statut du chauffeur déjà assigné.
- `docs/agents/permissions.md` mis à jour (la ligne sur les quick-popups legacy notait jusque-là qu'aucun n'avait été porté — plus vrai pour celui-ci).
- Client API régénéré (`pnpm --filter @cockpit/web api:generate`, conteneur `api` up requis).

### 2. Front — `apps/web/src/features/planning/` (nouveau dossier)

Même répartition que les verticales précédentes : `planning-status.ts` (filtres, port de `CATEGORY_COLORS`/`vehicleTypeColor()`, `tripDurationMinutes()`, nouveau `coversDate()` — pas d'équivalent v2 de `isWithinAvailabilityWindow` avant cette session), `planning-timeline-math.ts` (port pur de la géométrie du Gantt legacy — fenêtre de jours, clipping mi-nuit, + `nowLinePercent()` nouveau, sans équivalent legacy), `planning-timeline.tsx` (le Gantt), `planning-list.tsx` (vue Liste à plat, pas de split Local/Farm-out contrairement à Bookings), `planning-filters-bar.tsx`, `planning-page.tsx`.

**Réutilisé tel quel** (aucune duplication) : `trip-status.ts` (toutes les fonctions d'affichage trip), `StatusBadge`, `BookingEditDialog` (clic sur un bloc/carte/ligne), `AdvanceStepConfirmDialog`, `DriverUnavailabilityDialog`/`VehicleUnavailabilityDialog` (icônes 🫥/🔧), `useTripEvents` (SSE).

**Routing** : `router.tsx` (`/planning`), `app-shell.tsx` (lien nav "Planning").

## Bugs rencontrés et corrigés (code applicatif, pas des artefacts d'outil de test)

1. **`ROSTER_LIMIT = 200` dépassait le plafond backend réel** (`@Max(100)` sur `limit` dans `ListDriversQueryDto`/`ListFleetVehiclesQueryDto`, cohérent avec Clients/Drivers/Vehicles) → 400 immédiat au chargement de la page. Corrigé à 100. Le plan mentionnait 200 sans vérifier cette contrainte existante — à vérifier explicitement la prochaine fois qu'une limite est choisie "à vue de nez".
2. **Nom de ligne vide pour un partenaire "company only"** (ex. "Manual Test Partners", sans prénom/nom) : `DriverEntity.name` (calculé serveur, `computeDriverName()`) est délibérément vide dans ce cas (documenté dans le code lui-même — fidèle au legacy). Le Gantt utilisait `d.name` brut au lieu de `driverDisplayName(d)` (la fonction de repli déjà existante dans `trip-status.ts`, utilisée partout ailleurs dans Bookings pour exactement ce cas). Corrigé — leçon : ne jamais utiliser `.name` brut d'un driver, toujours `driverDisplayName()`.
3. **Mauvaise cible de drop pour "déposer un bloc sur la pile"** : le test Playwright ciblait le texte "Unassigned trips" (le titre), qui n'a pas de handler `onDrop` — seul un `<div>` frère en-dessous (le vrai conteneur de la pile) l'a. Corrigé en ajoutant un attribut `data-drop-zone="unassigned-pile"` sur ce conteneur (même esprit que `data-row-key`/`data-ref` déjà posés pour les lignes/cartes, à l'image de `data-row-key`/`data-ref` du legacy).
4. **`locator.dragTo()` de Playwright flaky sur ce drag&drop HTML5 natif** (mesuré : échoue ~30-50% du temps sur ce composant précis, alors qu'il passe sans souci ailleurs dans la suite existante). Remplacé par le pattern documenté par Playwright pour ce cas précis : dispatcher `dragstart`/`dragenter`/`dragover`/`drop`/`dragend` directement avec un `DataTransfer` JSHandle partagé entre les événements (`page.evaluateHandle(() => new DataTransfer())`), déterministe et sans dépendance au timing d'un mouvement de souris simulé.
5. **Race condition test, pas applicative** : `onAssign`/`onUnassign` dans `planning-page.tsx` appellent `void runAssign(...)` sans attendre la promesse (fire-and-forget, comme les autres mutations de la page) — un test qui vérifie l'état via un appel API direct juste après le drag arrive avant que le `PATCH /assign` n'ait fini. Corrigé côté test avec `page.waitForResponse()` explicite sur la requête `/assign`, pas côté app (le fire-and-forget est le bon pattern ici, cohérent avec le reste de la page).

## Passe design (Gantt)

Demandée explicitement par l'utilisateur une fois le fonctionnel validé ("dramatiquement moche"). Le premier jet reproduisait fidèlement la structure du Gantt legacy mais avec un style tableur brut (bordures pleines partout, pas de hiérarchie typographique, aucune séparation visuelle). Refonte visuelle (logique/comportement inchangés, aucune régression de test) :
- Conteneur en carte (`rounded-xl border shadow-sm`), en-tête d'heures avec fond `bg-muted/40` et typographie affinée.
- Colonne des libellés (chauffeur/véhicule) rendue **sticky** (`sticky left-0`) via une grille CSS à 2 colonnes (`grid-template-columns`) au lieu de flex — nécessaire pour que la ligne "now" (voir plus bas) puisse s'étendre proprement sur une seule colonne partagée par toutes les lignes.
- **Indicateur "maintenant"** (ligne rouge verticale + point), absent du Gantt legacy — ajouté en s'inspirant des conventions actuelles (Google Calendar/Linear/Notion Calendar), calculé par une nouvelle fonction pure testée (`nowLinePercent`), rendu comme un seul élément en overlay via `grid-row: N / span M` plutôt que dupliqué par ligne.
- **Légende de couleurs** (un point coloré par Catégorie de véhicule) — existait au legacy (`timeline-legend`) mais avait été omise dans le premier portage ; réintégrée.
- Icônes 🫥/🔧 remontées en vrais `<Button variant="ghost" size="icon-xs">` (cohérent avec le reste de l'app) au lieu de `<button>` bruts.
- Blocs de course et cartes de la pile : coins arrondis, ombre légère, `hover:shadow-md`, meilleure hiérarchie de texte. Pile passée en "étagère" à bordure pointillée (signale visuellement une zone de dépôt).
- Aucune classe `dark:` ad hoc ajoutée (l'app n'a pas de thème sombre — `index.css` ne définit aucun bloc `.dark`, cohérent avec le legacy "thème clair uniquement" ; une classe `dark:bg-neutral-900` isolée du premier jet a été retirée).

## Tests

- **Backend** : `trips.e2e-spec.ts` — nouveaux cas pour `category` (daily/event/all) et `/assign` (reset conditionnel du statut, rejet de catégorie incompatible, désassignation par chaîne vide, refs invalides). `permissions.e2e-spec.ts` — nouveau cas confirmant que `trip:edit-past` gate aussi `/assign`.
- **Frontend unit** : `planning-status.test.ts` (`vehicleTypeColor`, `coversDate`), `planning-timeline-math.test.ts` (fenêtre de jours, clipping mi-nuit, `nowLinePercent`).
- **Playwright** : nouveau `planning-lifecycle.spec.ts` — Gantt Chauffeurs (drag assign/unassign, icône 🫥), Gantt Véhicules (rejet catégorie incompatible + drop compatible, icône 🔧), vue Liste (toggle Daily/Event/All, clic→édition). Fixtures créées/nettoyées dans un `try/finally` par test (la base `cockpit_test` n'est jamais tronquée entre les runs — un trip orphelin après un échec resterait sinon dans la pile "demain" partagée par tous les runs suivants).

## Résultats finaux

- `pnpm --filter @cockpit/api test` → **27/27**
- `pnpm --filter @cockpit/api test:e2e` → **111/111** (+8 vs session -vehicles)
- `pnpm --filter @cockpit/api exec tsc --noEmit` → propre
- `pnpm --filter @cockpit/web test` → **191/191** (+23 vs session -vehicles)
- `pnpm --filter @cockpit/web exec tsc --noEmit -p tsconfig.app.json` → propre
- `pnpm --filter @cockpit/web lint` → 7 warnings, tous préexistants, aucun nouveau
- `pnpm --filter @cockpit/web exec playwright test` → **19/19** (+3 vs session -vehicles)
- Vérification manuelle au navigateur (chrome-devtools MCP) : les deux modes (Chauffeurs/Véhicules) × les deux vues (Liste/Timeline), drag&drop réel (assign + unassign + rejet d'incompatibilité), toggle Daily/Event/All, icônes de disponibilité, clic→édition. Aucune erreur console (hors warning React Router `HydrateFallback` déjà connu).

## Environnement pour reprendre

`docker compose` (dev, 5173/3000) déjà up, hot-reload actif sur `apps/api/src` et `apps/web/src` — aucun rebuild nécessaire au-delà de celui déjà fait en session pour le changement de DTO. Client API régénéré. Base dev nettoyée des trips de test créés pendant la session de vérification manuelle (rien laissé derrière). Suite Playwright tourne sur `cockpit_test` (ports 5174/3001, cf. `playwright.config.ts`) — non tronquée entre les runs, mais les nouveaux tests nettoient toujours leurs propres fixtures.

**Note d'outillage** : le `fill()` de chrome-devtools MCP sur un `<input type="date">` composite s'est révélé peu fiable pour déclencher l'`onChange` React pendant le débogage manuel (la valeur DOM change mais l'état React ne se met pas à jour) — a fait perdre du temps à tort soupçonner un bug applicatif. Playwright's propre `.fill()` sur le même type d'input fonctionne, lui, de façon fiable (déjà utilisé ailleurs dans la suite, ex. `booking-lifecycle.spec.ts`). À garder en tête pour la prochaine vérification manuelle impliquant un date-picker.

**Prochaine étape suggérée** : `/events` (sélection/création de compte événement, bouton "Create bulk") est la prochaine page authentifiée listée dans `docs/FRONTEND_PLAN.md`, et débloquerait le toggle Daily/Event/All de Planning (actuellement "Event" ne peut montrer que des courses créées manuellement en `EVENT` sans UI dédiée). Alternative : `/invoicing` (onglets Customer/Driver log/Partner log/History) ou clore la dette différée du padlock "délier véhicule↔chauffeur" (`common.js:969`, toujours hors périmètre).

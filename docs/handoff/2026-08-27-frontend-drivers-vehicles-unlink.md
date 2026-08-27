# Handoff — Cockpit v2, dette différée : padlock "délier véhicule↔chauffeur"

> Suite de `2026-08-27-frontend-planning.md`, qui proposait trois pistes pour la suite (`/events`, `/invoicing`, ou clore cette dette). L'utilisateur a choisi de clore la dette d'abord — le plus petit scope des trois.

**Session du** : 2026-08-27

## Contexte

Différé depuis les sessions Drivers et Vehicles (`docs/handoff/2026-08-27-frontend-drivers.md`, `2026-08-27-frontend-vehicles.md`) : le legacy (`common.js:3538` `linkedVehicleLine()`/`common.js:3565` `unlinkVehicleFromDriver()`) affiche, sous le nom d'un partenaire chauffeur ayant un véhicule External réservé (`FleetVehicle.driverRef === driver.ref`), une seconde ligne `🚘 <regNbr>` avec un cadenas fermé cliquable qui efface ce lien (`PATCH /api/fleet-vehicles/:ref/driver { driverRef: null }`). Sert à défaire l'auto-assignation de ce véhicule sur la barre de création de course quand ce chauffeur est sélectionné.

Une recherche préalable (agent Explore) a établi que **la mutation et la relation Prisma existaient déjà** :
- `PATCH /api/fleet-vehicles/:ref/driver` (`fleet-vehicles.controller.ts`/`.service.ts`) était déjà un port fidèle de l'endpoint legacy, déjà testé e2e (`fleet.e2e-spec.ts`), déjà utilisé par `LinkVehicleToPartnerDialog` (créé pendant la session Drivers).
- `Driver.fleetReserved` existait déjà côté schéma Prisma (`@relation("ReservedForDriver")`) — contrairement à ce que notaient les deux handoffs précédents ("nécessiterait une nouvelle relation inverse"), il ne manquait qu'un maillon : cette relation n'était exposée nulle part sur `DriverEntity`.

Donc tout le travail de cette session est un **ajout d'affichage** (back : exposer la relation existante ; front : rendre la ligne + le cadenas), pas une nouvelle mutation ni une migration.

## Ce qui a changé

### Back — `apps/api/src/`

- `fleet/dto/fleet-vehicle.entity.ts` : extraction de `FleetVehicleBaseEntity` (tous les champs bruts du véhicule, sans relations) dont `FleetVehicleEntity` hérite désormais (ajoute `category`/`driver`/`eventClient`/`unavailability`). Évite un import circulaire — `driver.entity.ts` importe déjà `FleetVehicleBaseEntity` en retour, comme `fleet-vehicle.entity.ts` importait déjà `DriverBaseEntity` dans l'autre sens ; ces classes n'étant que des types (aucune logique), TS élide l'import côté compilé et il n'y a pas de cycle à l'exécution — même principe déjà en place pour `DriverBaseEntity`.
- `drivers/dto/driver.entity.ts` : nouveau champ `fleetReserved: FleetVehicleBaseEntity | null` sur `DriverEntity`.
- `drivers/drivers.service.ts` : nouvelle constante `DRIVER_INCLUDE` (`{ eventClient: true, unavailability: true, fleetReserved: true }`) remplaçant les cinq `include` dupliqués (`list`/`create` ×2/`update`/`setActive`) — `withName()` mis à jour pour exiger `fleetReserved` dans sa contrainte de type. `setUnavailability()` (qui retourne `DriverWithUnavailabilityEntity`, pas `DriverEntity`) volontairement non touché.
- Client API régénéré (`pnpm --filter @cockpit/web api:generate`, conteneur `api` up requis).
- Aucun changement de permission : le padlock reste ungated côté legacy (`requireAuthApi` seulement) et `docs/agents/permissions.md` ne le liste pas — cohérence conservée, pas de nouvelle entrée ajoutée.

### Front — `apps/web/src/features/drivers/`

- `unlink-vehicle-dialog.tsx` (nouveau) : `AlertDialog` de confirmation ("Unlink this vehicle from the chauffeur?" / Unlink / Cancel, même esprit que `openConfirmDialog` du legacy), appelle `useFleetVehiclesControllerSetDriver()` avec `{ driverRef: null }`, invalide à la fois `getDriversControllerListQueryKey()` et `getFleetVehiclesControllerListQueryKey()` (les deux pages affichent ce lien).
- `drivers-table.tsx` : nouvelle prop `onUnlinkVehicle`, ligne `🔒 <regNbr>` (bouton `variant="ghost" size="icon-xs"`, icône Lucide `Lock` — pas d'emoji brut, cohérent avec le reste de l'app) ajoutée sous la cellule Nom, seulement quand `driver.fleetReserved` est non nul (donc seulement dans le tableau Partenaires en pratique, un chauffeur local n'ayant jamais de véhicule External réservé).
- `drivers-page.tsx` : état `unlinkTarget` + rendu du dialog, même schéma que `editTarget`/`unavailabilityTarget`.
- `test-fixtures.ts` (`baseDriver`) : `fleetReserved: null` ajouté aux valeurs par défaut.

## Tests

- **Backend** : nouveau cas e2e dans `drivers.e2e-spec.ts` — vérifie que `GET /api/drivers` expose `fleetReserved` (ref+regNbr) après un `POST /api/fleet-vehicles` avec `driverRef`, et qu'il repasse à `null` après `PATCH /fleet-vehicles/:ref/driver` avec un body vide. Le test de lien/déliaison sur l'endpoint lui-même existait déjà (`fleet.e2e-spec.ts`), inchangé.
- **Frontend unit** : `drivers-table.test.tsx` — deux nouveaux cas (pas de cadenas sans véhicule réservé ; cadenas affiché + `onUnlinkVehicle` appelé avec le bon driver au clic), plus mise à jour des fixtures/props existantes (`onUnlinkVehicle` désormais requis).
- **Playwright** : extension du test existant `"Ind." opens the Link-a-vehicle popup...` (`drivers-lifecycle.spec.ts`) plutôt qu'un nouveau test — après avoir créé le partenaire+véhicule lié, retour sur `/drivers`, clic sur le cadenas, vérification du texte de confirmation, clic Unlink, vérification du toast et de la disparition de la ligne, puis vérification croisée sur `/vehicles` (le texte du partenaire ne matche plus qu'une fois sur la ligne — colonne "Partner" seule, la sous-ligne driver ayant disparu).

## Bug d'outillage rencontré (pas applicatif)

Un premier run complet Playwright a échoué sur 2 tests de `vehicles-lifecycle.spec.ts` avec une erreur Vite `Failed to resolve import "@fontsource-variable/inter" from "src/main.tsx"` — un import qui n'existe nulle part dans le code source actuel (`main.tsx` ne l'importe pas, `package.json`/`pnpm-lock.yaml`/`node_modules` n'en ont aucune trace). Cause : cache obsolète `apps/web/node_modules/.vite` (pré-bundling Vite) issu d'un état antérieur du code, jamais invalidé. `rm -rf apps/web/node_modules/.vite` puis re-run → les deux tests passent. Sans rapport avec les changements de cette session (aucun fichier touché ici n'a de rapport avec les polices ou `main.tsx`). À garder en tête si un run Playwright échoue sur une erreur de résolution de module qui ne correspond à rien dans le code source.

## Résultats finaux

- `pnpm --filter @cockpit/api test` → **27/27**
- `pnpm --filter @cockpit/api test:e2e` → **113/113** (+1 vs session -planning)
- `pnpm --filter @cockpit/api exec tsc --noEmit` → propre
- `pnpm --filter @cockpit/web test` → **195/195** (+4 vs session -planning)
- `pnpm --filter @cockpit/web exec tsc --noEmit -p tsconfig.app.json` → propre
- `pnpm --filter @cockpit/web lint` → 7 warnings, tous préexistants, aucun nouveau
- `pnpm --filter @cockpit/web exec playwright test` → **19/19** (même nombre qu'après -planning — extension d'un test existant plutôt qu'un nouveau spec)
- Vérification manuelle au navigateur (chrome-devtools MCP) sur `/drivers` : cadenas visible sur le partenaire de test existant "Manual Test Partners" (MANUAL-LINK-01, laissé par une session précédente), clic → dialog de confirmation avec le bon texte, confirmation → toast + disparition de la ligne, vérifié aussi sur `/vehicles` (sous-ligne driver disparue). État restauré ensuite (relien via un appel `PATCH` direct) pour ne rien laisser de changé dans la base dev. Aucune erreur console.

## Environnement pour reprendre

`docker compose` (dev, 5173/3000) déjà up, hot-reload actif — aucun rebuild nécessaire au-delà de la régénération du client API déjà faite en session. Base dev restaurée à son état d'avant session (le lien manuel de test recréé après la vérification navigateur). Suite Playwright tourne sur `cockpit_test` (5174/3001) — si un run échoue sur une erreur de résolution de module Vite qui ne correspond à rien dans le code, voir la note d'outillage ci-dessus (`rm -rf apps/web/node_modules/.vite`).

**Prochaine étape suggérée** : les deux options du handoff précédent restent d'actualité — `/events` (débloque le toggle Daily/Event/All de Planning) ou `/invoicing` (onglets Customer/Driver log/Partner log/History), les deux pages authentifiées restantes de `docs/FRONTEND_PLAN.md`.

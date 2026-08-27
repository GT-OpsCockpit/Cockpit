# Handoff — Cockpit v2, verticale `/vehicles` (Fleet)

> Suite de `2026-08-27-frontend-drivers.md`, qui suggérait explicitement `/vehicles` comme prochaine étape et différait à cette occasion le popup legacy "lier un véhicule à un partenaire fraîchement créé" (point 7 de ce handoff). C'est fait ici — `/vehicles` est la troisième verticale de gestion (après Clients, Drivers), et le popup de liaison est construit en même temps puisqu'il dépend de Fleet.

**Session du** : 2026-08-27

## Décision de cadrage

Un plan a été soumis et validé avant l'implémentation. Décisions actées :
1. **Deux tableaux avec des colonnes différentes** (pas juste un split comme Drivers) — fidèle au legacy `vehicles.html` : "Fleet - Internal" (Category/RegNbr/Acr/Make/Model/Year/4WD/NbPax/Color, icône 🔧 indisponibilité) et "Fleet - External" (+ Country/Area/Partner en tête, pas d'icône indisponibilité — `setUnavailability` est déjà restreint aux véhicules `isLocal` côté back).
2. **Nb Pax jamais un champ libre** — recalculé côté client à chaque changement de Catégorie/Modèle via `defaultFleetPax()`, porté tel quel du legacy (`vehicles.html:369-378`). Le back accepte n'importe quelle valeur 0–50 dans `CreateFleetVehicleDto.nbPax` mais ne la recalcule jamais lui-même — c'est bien au front de le faire, comme le legacy.
3. **4WD en vrai booléen** (`Checkbox`), pas la sérialisation `"Yes"/"No"` que le legacy envoyait à son propre back — un artefact client-side du `<select>` legacy, pas une règle métier à reproduire (même principe déjà acté en session Clients : ne pas copier les mauvais patterns d'implémentation du legacy).
4. **`vehicle:reactivate`** (ADMIN) — suggéré explicitement dans `docs/agents/permissions.md` (`vehicles.html:574`), même forme que `driver:reactivate` : gate conditionnel dans `FleetVehiclesService.setActive()` sur la transition `false→true` uniquement.
5. **Popup "Lier un véhicule à ce partenaire"** (repris du point 7 différé par la session Drivers) : sur `DriverCreateDialog`, une case "Ind." (activée dès que Company est rempli) ouvre ce popup directement après création ; sinon, un chauffeur `eventsOnly`+Company créé déclenche une confirmation Oui/Non. Le popup réutilise `VehicleFormFields` avec `isLocal` forcé/verrouillé à `false` et `partnerCompany` préreempli — mais **Country/Area restent à saisir manuellement**, fidèle au legacy (`openLinkVehicleToPartnerModal`, drivers.html) qui ne les reprend pas non plus du formulaire chauffeur.
6. **Hors périmètre, explicitement différé** : le padlock "délier ce véhicule" sous le numéro de mobile d'un chauffeur (`common.js:969`, `unlinkVehicleFromDriver`) — nécessiterait une nouvelle relation inverse `DriverEntity.fleetVehicle`, ce qui rouvrirait la verticale Drivers. Non construit ici.
7. Pas de bouton de suppression définitive dans le tableau, pas de gestion de Catégories (VehicleType CRUD) — le legacy n'a jamais eu un tel écran, cohérent avec Clients/Drivers.

## Ce qui a changé

### 1. Back — `vehicle:reactivate` + nesting `eventClient`

- `apps/api/src/common/permissions/permissions.ts` — `'vehicle:reactivate': [Role.ADMIN]`.
- `apps/api/src/fleet/fleet-vehicles.controller.ts`/`fleet-vehicles.service.ts` — `setActive()` prend `user: AuthenticatedUser`, lève un 403 sur la transition `false→true` sans la permission (copie conforme du gate `DriversService.setActive()`).
- `FleetVehicleEntity` gagne `eventClient: ClientBaseEntity | null` (`FLEET_VEHICLE_INCLUDE` += `eventClient: true`) — même gap déjà comblé sur `DriverEntity` en session -drivers, nécessaire pour préremplir le sélecteur d'Événement à l'édition.
- Client API régénéré.
- Le reste de `FleetVehiclesService`/`VehicleTypesService` (pagination, recherche, CRUD, `setDriver`, `setUnavailability`) était déjà en place depuis une session backend antérieure — rien d'autre à construire côté back pour cette verticale.

### 2. Front — `apps/web/src/features/fleet/` (calque de `features/drivers/`)

Mêmes noms de fichiers, même répartition de responsabilités que Drivers : `vehicle-status.ts` (filtres, `unavailabilityLabel()`, et **`defaultFleetPax()`** porté du legacy), `vehicle-form-schema.ts` (zod miroir de `assertValid()`), `vehicle-form-mapping.ts`, `vehicle-form-fields.tsx` (Catégorie→Marque→Modèle chaînés, Local, Country/Area/Partner, Events), `vehicles-table.tsx` (deux tableaux **à colonnes différentes**), `vehicle-filters-bar.tsx`, `vehicle-create-dialog.tsx`/`vehicle-edit-dialog.tsx`, `vehicle-unavailability-dialog.tsx` (REPAIR/SERVICE/BODYWORK, type-verrouillé), `vehicles-page.tsx`. Nouveau : `link-vehicle-to-partner-dialog.tsx` (popup de liaison, décrit au point 5).

**Wiring Drivers → Fleet** : `driver-create-dialog.tsx` gagne une case "Ind." (état local, pas un champ du schema/DTO) et un `AlertDialog` Oui/Non pour la branche `eventsOnly`+Company, tous deux ouvrant `LinkVehicleToPartnerDialog` après une création réussie. `driverDisplayName()` (déjà dans `features/bookings/trip-status.ts`) réutilisé pour l'affichage — nécessaire car `driver.name` est vide pour un partenaire "company seulement" sans chauffeur nommé.

**Routing** : `apps/web/src/router.tsx` (`/vehicles`), `apps/web/src/components/layout/app-shell.tsx` (lien nav "Vehicles").

## Bug rencontré et corrigé (code applicatif, pas un problème d'outil de test)

En construisant le chaînage Catégorie→Marque→Modèle (3 `<Select>` shadcn/Radix imbriqués, chacun recalculant les options du suivant), une combinaison précise s'est révélée cassée : sélectionner une Catégorie mettait bien à jour Marque (auto-calculée), mais **Modèle restait vide et la validation le signalait "Model is required."** — alors que la valeur calculée (`nextModel`) était correcte. Confirmé au navigateur (chrome-devtools MCP) : ni `form.setValue()` en cascade ni `form.reset()` en un seul appel ne suffisaient.

**Cause** : Radix `<Select>` n'affiche/n'enregistre une valeur que pour un `<SelectItem>` qui a déjà été effectivement rendu par ce composant. Au montage, le champ Marque tombe par accident sur la liste complète des marques (`makesFor()` retourne `fleetMakes` en fallback quand aucune Catégorie n'est choisie) — la valeur auto-choisie s'y trouve donc toujours déjà. Le champ Modèle n'a pas cette chance : sa liste de fallback est vide tant que Catégorie *et* Marque ne sont pas connus, donc la première valeur auto-calculée n'a jamais été rendue avant que `value` ne pointe dessus.

**Fix** : chaque `<Select>` en aval d'un champ qui peut changer sa propre liste d'options porte désormais une prop `key` dérivée des champs dont il dépend (`key={category}` pour Marque, `key={\`${category}:${make}\`}` pour Modèle — `vehicle-form-fields.tsx`). Un changement de clé force un remontage complet du `<Select>`, dont le tout premier rendu a déjà la bonne liste d'options *et* la bonne valeur ensemble — le seul cas qui marche de façon fiable. **À retenir pour tout futur `<Select>` en cascade dans ce projet** (`trip-form-fields.tsx`'s Vehicle field n'a qu'un seul niveau et n'a jamais été exposé à ce cas).

## Tests

- **Backend** : `permissions.e2e-spec.ts` — nouveau cas "vehicle:reactivate only gates the false→true transition", copie conforme du cas `driver:reactivate`.
- **Frontend unit** : `vehicle-status.test.ts` (dont `defaultFleetPax` — une valeur par catégorie + les deux branches Van/E-Van selon le modèle), `vehicle-form-schema.test.ts` (branches `assertValid`), `vehicles-table.test.tsx` (split Internal/External à colonnes différentes, gate Reactivate, wrench uniquement sur Internal).
- **Playwright** : nouveau `vehicles-lifecycle.spec.ts` — création interne/externe/eventsOnly (avec les transitions Catégorie→Marque→Modèle qui exercent directement le bug ci-dessus), édition avec préremplissage (Événement par ref), popup indisponibilité (set/lock/clear), désactivation/réactivation ADMIN, recherche, pagination ; `vehicle:reactivate` RBAC (DISPATCHER). Nouveau cas dans `drivers-lifecycle.spec.ts` couvrant le popup de liaison via "Ind." — chauffeur partenaire créé → popup s'ouvre → véhicule créé avec le bon `driverRef` → apparaît dans "Fleet - External" avec le nom du chauffeur affiché.
- **Note d'environnement** : la base `cockpit_test` a été réinitialisée (`prisma migrate reset --force`, avec le consentement explicite de l'utilisateur — Prisma bloque cette commande par défaut pour un agent) après que des runs Playwright répétés en cours de session aient accumulé des chauffeurs/véhicules de test résiduels (le script de seed est idempotent/additif, pas une purge). Base propre à la fin de la session.

## Résultats finaux

- `pnpm --filter @cockpit/api test` → **27/27**
- `pnpm --filter @cockpit/api test:e2e` → **103/103** (+1 vs session -drivers)
- `pnpm --filter @cockpit/api exec tsc --noEmit` → propre
- `pnpm --filter @cockpit/web test` → **168/168** (+38 vs session -drivers)
- `pnpm --filter @cockpit/web exec tsc --noEmit -p tsconfig.app.json` → propre
- `pnpm --filter @cockpit/web lint` → 7 warnings, 6 préexistants + 1 nouveau (`driver-create-dialog.tsx`, `incompatible-library` sur `form.watch()` — même catégorie qu'un warning déjà accepté ailleurs dans le projet, pas une nouvelle classe de problème)
- `pnpm --filter @cockpit/web exec playwright test` → **16/16** (+4 vs session -drivers), contre `cockpit_test` fraîchement réinitialisée
- Vérification manuelle au navigateur (chrome-devtools MCP) : création interne/externe/eventsOnly, chaînage Catégorie→Marque→Modèle sur plusieurs transitions successives (Business→Van→SUV), édition, popup indisponibilité (set/lock/clear), désactivation/réactivation ADMIN, et le flux complet "Ind." depuis Drivers jusqu'à l'apparition du véhicule lié sur `/vehicles` — aucune erreur console sur toute la session (seul le warning React Router `HydrateFallback` déjà connu et sans rapport).

## Environnement pour reprendre

`docker compose up --build api web` exécuté en cours de session (régénération du client API après le changement `eventClient`). Le conteneur `web` (dev) recharge les sources en hot-reload — pas de rebuild nécessaire pour les changements de cette session au-delà de celui déjà fait. Migration Prisma inchangée. Base `cockpit_test` réinitialisée (voir ci-dessus) — le prochain `pnpm --filter @cockpit/api test:e2e`/`playwright test` la reseed automatiquement comme d'habitude.

**Prochaine étape suggérée** : `/planning` (toggle chauffeurs/véhicules, vue liste + Gantt drag&drop) est la prochaine page authentifiée listée dans `docs/FRONTEND_PLAN.md` après Clients/Drivers/Vehicles, et c'est la première à dépendre des trois verticales de gestion désormais terminées (elle assigne des chauffeurs et véhicules aux courses). Alternative plus légère si on veut d'abord clore une dette : construire le padlock "délier véhicule↔chauffeur" différé au point 6 ci-dessus, ou `/events`.

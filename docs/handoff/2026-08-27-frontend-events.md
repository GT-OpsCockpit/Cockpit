# Handoff — Cockpit v2, verticale `/events`

> Suite de `2026-08-27-frontend-drivers-vehicles-unlink.md`. L'utilisateur a choisi `/events` entre les deux options restantes du `docs/FRONTEND_PLAN.md` (`/events`, `/invoicing`).

**Session du** : 2026-08-27

## Contexte

`/events` est la 6ᵉ des 8 pages authentifiées listées dans `docs/FRONTEND_PLAN.md`. Une recherche préalable (agent Explore + lectures directes) a établi que **tout le modèle de données et toutes les mutations nécessaires existaient déjà**, bâtis lors des sessions Drivers/Vehicles/Planning :

- `Client.clientType = EVENT` + 4 champs (`eventCountry`/`eventArea`/`eventStartDate`/`eventEndDate`) — schéma Prisma, validation `ClientsService.create/update`.
- `GET /api/clients?type=event` — déjà utilisé par le picker "Événement" de Drivers.
- `GET /api/trips?category=daily|event|all` — ajouté pour le toggle Daily/Event/All de Planning.
- `POST /api/trips` — création simple, toutes les règles métier (pax≤max, ASD/SPEC, etc.) déjà en place.

Donc cette session est presque entièrement de la **composition front**, plus un seul ajout backend (permission conditionnelle sur la création d'un compte Events à date passée). Legacy lu intégralement : `Cockpit/suivi-chauffeur-twilio/public/events.html` (952 lignes).

## Ce qui a changé

### Back — `apps/api/src/`

- `common/permissions/permissions.ts` : nouvelle permission `client:create-past-event` (`[Role.ADMIN]`) — legacy gate ce cas séparément via `OWNER_PASSWORD` (`clients.html:474`/`events.html:439`).
- `clients/clients.service.ts` `create()` : gate conditionnel (façon `TripsService.update()`'s `trip:edit-past`) — si `clientType === EVENT` et `eventStartDate` est avant aujourd'hui (zone Paris), exige `can(user, 'client:create-past-event')`, sinon `ForbiddenException`. Seul `create()` est gaté (le legacy ne gate que la création, pas l'édition).
- `clients/clients.controller.ts` : `create()` reçoit désormais `@CurrentUser()`.
- Client API régénéré (`pnpm --filter @cockpit/web api:generate`).
- `docs/agents/permissions.md` : ligne 102 passée de ❌ à ✅.

### Front — nouveau dossier `apps/web/src/features/events/`

- `event-select-panel.tsx` — panneau "Select event" : picker request-on-demand (même pattern que le picker "Événement" de `driver-form-fields.tsx`), champs Événement/Dates en lecture seule, boutons Cancel/New/Confirm. Confirmer verrouille le champ Customer de la barre de création. Pas de bouton "unconfirm" — comportement identique au legacy (reconfirmer un autre événement re-cible juste le verrou).
- `event-client-create-dialog.tsx` — flux "New" en **un seul dialog** (pas le chaînage à deux popups du legacy) : réutilise `ClientFormFields` avec une nouvelle prop `typeLocked` (verrouille juste le `<Select>` Account type, ne le cache pas — mirrors le champ "Type" disabled du legacy). Écart délibéré vis-à-vis du legacy assumé comme UX/implémentation, pas logique métier (mêmes champs, même validation).
- `event-creation-bar.tsx` — nouveau composant (pas une réutilisation de `BookingCreationBar` — boutons différents). Réutilise `TripFormFields` via deux nouvelles props ciblées ajoutées à ce composant partagé : `clientFieldDisabled` (verrouille juste le champ Customer) et `clientSeedOption` (nourrit le combobox Customer avec l'événement confirmé, qui est exclu par construction de la recherche clients normale — `clientType !== 'EVENT'`). Clé de brouillon localStorage dédiée (`newEventBookingDraft`, distincte de `newBookingDraft`) pour qu'une référence client verrouillée ne fuite jamais vers la barre Bookings normale.
- `bulk-create.ts` — port pur (donc testable unitairement) de la logique de chaînage du legacy (`events.html:637-675`) : `eachDateInRange`, `bulkLegForIndex`, `buildBulkTripDto`.
- `bulk-dates-dialog.tsx` — modal "Create bulk" : dates pré-remplies depuis l'événement confirmé, référence/instructions optionnelles, boucle **séquentielle** (pas `Promise.all` — compteur de ref partagé côté serveur, même raison que le legacy).
- `event-filters-bar.tsx` / `event-filters.ts` — barre de recherche + filtrage pur, miroir du bloc Search du legacy (Client événement-only, Pays, plage de dates, Type véhicule, Nom événement, Ref/PO/Autre).
- `events-page.tsx` — composition : réutilise directement `BookingsTable` (variant `'local'` — la Ride list du legacy a exactement les mêmes 10 colonnes, Reg Nbr **et** Sub-C), et les 5 dialogs de Bookings (`BookingEditDialog`, `BookingCancelDialog`, `DispatchConfirmDialog`, `AdvanceStepConfirmDialog`, `NameboardUploadDialog`) tels quels — même précédent d'import cross-feature déjà établi par `features/planning/*`.
- `apps/web/src/features/clients/client-form-fields.tsx` : nouvelle prop `typeLocked` (verrouille le Account-type `<Select>`).
- `router.tsx` / `app-shell.tsx` : route + entrée nav `/events`, après Planning.

### Bug latent découvert et corrigé (règle du projet : tout bug trouvé est corrigé, pas différé)

`ClientEntity.eventStartDate`/`eventEndDate` sont des colonnes Prisma `DateTime`, sérialisées en ISO complet (`2027-06-01T00:00:00.000Z`), pas en date pure — un `<input type="date">` rejette silencieusement tout ce qui n'est pas `YYYY-MM-DD` et affiche le champ vide. Trois endroits touchés, tous corrigés (`.slice(0, 10)`) : l'affichage des Dates dans `event-select-panel.tsx`, le préremplissage dans `bulk-dates-dialog.tsx`, et `apps/web/src/features/clients/client-form-mapping.ts`'s `clientToFormValues()` — ce dernier découvert en testant l'édition du compte Events créé en session depuis `/clients` (Start/End date apparaissaient vides). Nouveau test de régression : `client-form-mapping.test.ts`.

## Tests

- **Backend e2e** : nouveau cas dans `permissions.e2e-spec.ts` — création d'un compte Events à date passée : DISPATCHER → 403, ADMIN → 201 ; date future → 201 pour les deux rôles.
- **Frontend unit** : `bulk-create.test.ts` (12 cas — chaînage, stripping driver/vehicle/partner, forçage ASD sur le dernier jour avec/sans heures déjà valides, fusion référence/instructions), `event-filters.test.ts` (7 cas), `client-form-mapping.test.ts` (2 cas, régression sur le bug de dates ci-dessus). Pas de test composant dédié pour `event-creation-bar.tsx` (aucun précédent dans le repo pour tester un composant formulaire dépendant du réseau en isolation — la barre de création Bookings elle-même n'en a pas non plus) ; couvert à la place par le test Playwright.
- **Playwright** : nouveau `events-lifecycle.spec.ts` — création d'un compte Events via "New", Confirm, création d'une course simple, "Create bulk" sur 3 jours avec vérification de la règle de chaînage (`Nice Airport → Hotel Negresco`, `Hotel Negresco → Hotel Negresco`, `Hotel Negresco → ASD (4h)`), vérification que la référence apparaît dans le champ Info d'une des courses, filtre Nom événement. Assertions scopées par le nom d'événement unique (`Date.now()`) après le "Create bulk" — la base e2e n'étant pas tronquée entre runs, une assertion non scopée (`toHaveCount(2)`) cassait au deuxième passage (voir commentaire dans le fichier).

## Résultats finaux

- `pnpm --filter @cockpit/api test` → **27/27**
- `pnpm --filter @cockpit/api test:e2e` → **113/113**
- `pnpm --filter @cockpit/api exec tsc --noEmit` → propre
- `pnpm --filter @cockpit/web test` → **214/214** (+19 vs session précédente)
- `pnpm --filter @cockpit/web exec tsc --noEmit -p tsconfig.app.json` → propre
- `pnpm --filter @cockpit/web lint` → 8 warnings (7 préexistants + 1 nouveau de la même catégorie déjà acceptée sur `booking-creation-bar.tsx` — `useTripsControllerCreate()` non mémoïsable par le React Compiler)
- `pnpm --filter @cockpit/web exec playwright test` → **20/20** (+1, exécuté deux fois de suite pour vérifier la stabilité face à l'accumulation de données)
- Vérification manuelle au navigateur (chrome-devtools MCP) sur `/events` : création d'un compte Events "Cannes Test Gala" (CE2), Confirm (verrouille Customer), création simple, "Create bulk" sur 3 jours — 3 courses créées avec la règle de chaînage exacte, référence visible dans le dialog d'édition, filtre Nom événement fonctionnel. Aucune erreur console (hors avertissement `HydrateFallback` préexistant, sans rapport).

## Environnement pour reprendre

`docker compose` (dev, 5173/3000) déjà up, hot-reload actif. Client API régénéré en session (permission `client:create-past-event`). Suite Playwright tourne sur `cockpit_test` (5174/3001), non tronquée entre runs — cf. note sur le scoping des assertions ci-dessus si un futur test dans ce fichier semble flaky en run répété.

Données laissées dans la base dev (pas nettoyées, cohérent avec le précédent déjà noté dans le handoff unlink — "Manual Test Partners" laissé par une session antérieure) : client Events `CE2` "Cannes Test Gala" + 3 courses `R-CE2-26-1/2/3` (dates 2027-06-01→03, sans conséquence).

**Prochaine étape suggérée** : `/invoicing` (onglets Customer/Driver log/Partner log/History) — dernière page authentifiée de `docs/FRONTEND_PLAN.md` avant `/finance` (stub) et `/settings`.

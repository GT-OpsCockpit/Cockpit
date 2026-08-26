# Handoff — Frontend Cockpit v2, verticale Login + Bookings

> Journal de sessions : chaque handoff s'ajoute ici en fichier daté, jamais réécrit par-dessus l'historique. Voir aussi `docs/FRONTEND_PLAN.md` (Journal) pour les décisions de cadrage — pas dupliquées ici.

**Session du** : 2026-08-26 / 2026-08-27
**Portée** : implémentation du frontend `apps/web`, verticale complète décidée en grilling (fondations + `/login` + `/bookings`). Décisions de cadrage complètes dans `docs/FRONTEND_PLAN.md` § Journal (entrée "Lancement de l'implémentation (grilling #2)").

---

## Où on en est en une phrase

Auth + shell + routing sont **finis et vérifiés au navigateur réel** (login → OTP → session → logout, aucune erreur console). La page Bookings est un placeholder ; tout le gros morceau (formulaire de course, tableaux, dialogs) est écrit mais **non branché, non type-checké, non testé** — c'est la reprise immédiate.

---

## Fait et vérifié (tests + navigateur)

### 1. Backend — ajouts additifs (mergés dans `apps/api`, 84/84 e2e passent)

- `GET /api/auth/me` — `apps/api/src/auth/auth.controller.ts` + `auth.service.ts`
- Provider WhatsApp "dev" — `apps/api/src/notifications/dev-log-whatsapp.provider.ts`, sélectionné par une factory dans `notifications.module.ts` quand `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` sont absents **et** `NODE_ENV !== production` (jamais de fallback silencieux en prod)
- `prisma/seed-data.ts` étendu (`seedFixtures`) : 2 clients, 3 chauffeurs (2 internes + 1 partenaire), 2 véhicules flotte. Génération de refs faite en SQL brut, **pas** via les services NestJS — le seed tourne sous `tsx`, dont le transform esbuild ne supporte pas `emitDecoratorMetadata` ; bootstrapper l'app Nest complète depuis ce script casse l'injection par type (constaté en pratique sur `TwilioWhatsAppProvider`). Détail en commentaire dans le fichier.
- `docker-compose.override.yml` : le service `api` en dev n'avait **aucune** variable d'env chargée (seul `docker-compose.yml` prod forwarde `DATABASE_URL`/`PORT`). Ajouté `env_file: ./apps/api/.env` sous `api` (dev only).

### 2. Backend — Swagger + client généré (délégué à un agent, résultat vérifié)

- `@nestjs/swagger` + CLI plugin (`classValidatorShim: true`, `dtoFileNameSuffix` inclut `.entity.ts`) dans `apps/api/nest-cli.json`
- Toutes les réponses de contrôleurs typées via de nouvelles classes `*.entity.ts` (une par module) — **nécessaire** : le plugin n'infère les schémas de réponse que depuis de vraies `class`, pas depuis des `interface`/`type` (y compris les types Prisma générés)
- `GET /api/docs-json` exposé, vérifié exact sur plusieurs endpoints
- SSE (`/api/events/stream`) et l'upload nameboard restent volontairement peu typés
- `orval` configuré (`apps/web/orval.config.ts`), génère dans `packages/shared/src/api` (`tags-split`, `client: react-query`, `httpClient: fetch`, mutator = `packages/shared/src/api/fetcher.ts`)
- **Bug trouvé et corrigé après coup** (par moi, pas l'agent) : sans `override.fetch.includeHttpResponseReturnType: false`, le code généré attendait `{data, status, headers}` du mutator alors que `fetcher.ts` renvoie le corps brut — chaque `.data` aurait été `undefined` au runtime. Corrigé + régénéré.
- `packages/shared/src/api/index.ts` exporte aussi `fetcher.ts` (`ApiError`, `fetcher`, `getBaseUrl`), pas seulement `model`+`endpoints`.

### 3. Frontend — fondations, tout vérifié au navigateur (chrome-devtools MCP)

- Tailwind v4 CSS-first (`apps/web/src/index.css`) : tokens oklch, accent vert legacy `#128C7E`, compatible shadcn
- shadcn/ui installé **manuellement** (le projet existait déjà, pas de `shadcn init -t vite`) : `components.json` à la main, alias `@` dans `vite.config.ts` (via `import.meta.dirname`, pas `__dirname`) et `tsconfig.app.json` (`paths` seul — pas `baseUrl`, deprecated sur cette version de TS).
  - **Piège rencontré** : le premier `pnpm dlx shadcn@latest add ...` a créé les fichiers dans un dossier littéral `apps/web/@/components/ui/*` au lieu de résoudre l'alias. Déplacés à la main vers `apps/web/src/components/ui/`, `lib/utils.ts` recréé à la main (le CLI ne l'avait pas généré).
  - Composants ajoutés : button, card, input, label, form, dialog, alert-dialog, table, tabs, badge, select, popover, command, separator, sonner, checkbox, dropdown-menu, avatar, skeleton, textarea, switch.
- Dépendances ajoutées via `pnpm` sur le **host** (`node_modules` n'est pas bind-mounté dans le conteneur — après tout changement de `package.json`, faire `docker compose up --build web`) : `react-router` (v7/v8 — **pas** `react-router-dom`, déprécié), `react-hook-form`, `zod`, `@hookform/resolvers`, `luxon`+`@types/luxon`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`.
- Auth complet et testé bout-en-bout (login → OTP dev auto-rempli → cookie session → `/bookings` → logout → retour `/login`) :
  - `apps/web/src/lib/query-client.ts` — `QueryCache.onError` redirige vers `/login` sur toute 401 (garde actuelle : `window.location.pathname !== '/login'`, à surveiller si des faux-positifs apparaissent sur d'autres routes publiques futures)
  - `apps/web/src/router.tsx` — loaders `requireAuth` / `redirectIfAuthenticated`
  - `apps/web/src/features/auth/login-page.tsx` — flow 2 étapes, countdown 5 min, devCode auto-rempli
  - `apps/web/src/components/layout/app-shell.tsx` — header + logout
  - `apps/web/src/lib/api-error.ts` — extrait `{error: '...'}` (format `ApiExceptionFilter`)
- `apps/web/src/features/bookings/bookings-page.tsx` : **placeholder** (`<h1>Bookings</h1>`), rien de réel dedans.

---

## En cours — écrit mais non vérifié, à reprendre en premier

Rien de tout ça n'a été type-checké après écriture (`pnpm exec tsc -b --force` dans `apps/web` pas relancé), ni testé au navigateur.

- **`apps/web/src/features/bookings/trip-status.ts`** — helpers de statut/affichage traduits depuis `Cockpit/suivi-chauffeur-twilio/public/common.js` : `currentStatus` (~L2379), `STEP_ORDER`/`STEP_LABELS` (~L2373), `isLocalTrip` (~L2945), `statusBadgeAndRowClass` (~L2430), `itineraryCell` (~L2618), `dispatchActionButtonHtml` (~L2536).
- **`apps/web/src/features/bookings/use-trip-events.ts`** — hook SSE en `EventSource` natif (**pas** le hook orval `useRealtimeControllerStream`, inadapté à un flux persistant). Jamais vérifié que le navigateur reçoit les events et invalide bien le cache.
- **`apps/web/src/components/search-combobox.tsx`** — combobox générique (Popover+Command) pour Country/Customer/Driver/Partner.
- **`apps/web/src/features/bookings/trip-form-schema.ts`** — schéma Zod miroir de `apps/api/src/trips/dto/create-trip.dto.ts` + règles dans `trips.service.ts` (ASD → hours 2-48, SPEC → instructions requis, dropoffLocation requis sauf ASD).
- **`apps/web/src/features/bookings/trip-form-fields.tsx`** — le plus gros morceau, écrit en dernier avant l'arrêt (~500 lignes). Reproduit la barre "New booking" de `dispatcher.html` (L34-196) champ par champ, partagé création/édition. **Pas encore importé nulle part.**
  - Simplifications **déjà décidées consciemment** pendant l'implémentation (pas des oublis, mais pas validées explicitement par l'utilisateur) :
    - PU/DO et POC-name : `<Input>` simples + résolution timezone/IATA à la demande (bouton 📍, appel `geoControllerGeocodeTz` au clic) plutôt que des comboboxes à suggestions live (`geoControllerGeocodeSearch`/`geoControllerPocSearch` générés mais pas utilisés).
    - Partner (sous-traitance) : un seul combobox listant les chauffeurs avec `company` renseignée, au lieu du flow legacy en 2 étapes — colle au contrat serveur (`partnerRef` est le seul champ DTO).

---

## Pas commencé

1. Finir/vérifier/type-checker `trip-form-fields.tsx` et le brancher.
2. Composant "barre de création" — persistance brouillon `localStorage` (cf. `LEGACY_FEATURES.md` §10 dispatcher.html), boutons Create / Create & Dispatch (`POST /api/trips` puis éventuellement `POST /api/trips/:ref/dispatch-driver`).
3. Tableaux Local/Farm out + barre de filtres (recherche, période upcoming/today/week/past/all, client, chauffeur, passager, véhicule, service) — logique de filtrage/tri/split dans `dispatcher.html` L307-552, déjà comprise et partiellement transcrite dans `trip-status.ts`.
4. Dialog d'édition complète (réutilise `trip-form-fields.tsx` en mode edit + case `notifyDriver` "Confirm and send").
5. Dialog d'annulation avec gate mot de passe manager (`POST /api/auth/verify-password` puis `POST /api/trips/:ref/cancel-assignment`).
6. Dialog "Valider l'étape ?" (`POST /api/trips/:ref/advance-step`), déclenché par clic sur le badge de statut si `isStatusAdvanceable`.
7. Dialog de dispatch (`POST /api/trips/:ref/dispatch-driver`) — bouton visuellement grisé mais cliquable si driver/véhicule manquant (cf. `dispatchActionButtonHtml`).
8. Upload nameboard (`POST /api/trips/:ref/nameboard`, multipart) — rien commencé.
9. Wiring `useTripEvents()` dans `bookings-page.tsx`.
10. Tests — niveau décidé avec l'utilisateur : **suite complète Vitest/Testing Library + Playwright e2e** sur le parcours création→dispatch→statuts. Rien écrit, Playwright pas encore installé dans `apps/web`.
11. Vérification manuelle complète au navigateur du parcours bout-en-bout une fois tout branché.

---

## Environnement pour reprendre

- Stack Docker déjà up (`docker compose ps` depuis `cockpit-v2/`) : postgres (5432), api (3000, `nest --watch`), web (5173, Vite HMR).
- `cockpit-v2` **est** un repo git (nested — le dossier parent ne l'est pas). `git status`/`git diff` fonctionnent directement dedans.
- Identifiants admin dev : `apps/api/.env` (`ADMIN_EMAIL`/`ADMIN_PASSWORD`). `AUTH_DEV_OTP=true` → le code OTP revient dans la réponse JSON (`devCode`), pas besoin de SMTP.
- Après un changement de DTO/controller côté API, régénérer le client : API up sur :3000, puis `pnpm --filter @cockpit/web api:generate` depuis la racine.
- Après un changement de `apps/web/package.json`, rebuild le conteneur : `docker compose up --build web` (node_modules pas bind-monté).

**Première étape concrète recommandée** : `pnpm exec tsc -b --force` dans `apps/web` pour voir l'état réel de `trip-form-fields.tsx` (probables erreurs de types sur les champs optionnels RHF/zod), puis construire le wrapper barre de création et le brancher dans `bookings-page.tsx` pour un premier aller-retour testable (créer une course avec les données de seed).

---

## Suggested skills pour la prochaine session

- **placeloop-frontend-designer** — pas applicable (ce n'est pas un projet Placeloop), à ignorer si suggéré automatiquement.
- Aucun skill dédié Cockpit n'existe encore dans ce repo. Si le pattern de session (cadrage → implémentation → handoff) se répète, envisager de créer un skill de projet local (`.claude/skills/`) qui pointe vers `docs/FRONTEND_PLAN.md`, `docs/LEGACY_FEATURES.md` et ce dossier `docs/handoff/` pour éviter de re-décrire le contexte à chaque session.
- Pour la suite immédiate (débogage TS + branchement de composants) : pas besoin de skill particulier, travail d'implémentation directe.
- Quand la suite de tests (Vitest + Playwright) sera attaquée : pas de skill dédié requis, mais consulter `docs/FRONTEND_PLAN.md` § Journal pour le niveau de rigueur déjà validé avec l'utilisateur.

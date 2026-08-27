# Handoff — Cockpit v2, pages publiques `/driver/:ref` et `/track/:ref`

> Suite de `2026-08-27-frontend-settings.md`. Avec Settings, `/finance` (stub) et ces deux pages publiques étaient les seuls éléments restants de `docs/FRONTEND_PLAN.md`. Choix fait en début de session (aucune contrainte de l'utilisateur, qui a laissé le choix) : ces deux pages plutôt que le stub `/finance`, car l'état des lieux (agent de recherche) a immédiatement fait remonter un vrai problème de sécurité à corriger avant de les construire — voir plus bas.

**Session du** : 2026-08-27

## Contexte

`GET /api/trips/:ref` (et `POST /api/trips/:ref/notify`) étaient déjà `@Public()` depuis la verticale Bookings/Trips — construits pour ça, jamais consommés côté front jusqu'ici. Un état des lieux en tout début de session a révélé que ces deux endpoints publics renvoyaient la `TripEntity` **complète**, sans aucune projection : `priceEur`/`partnerRateEur`, le `ClientBaseEntity` entier (n° TVA, adresse, email…) et les deux `DriverBaseEntity` (chauffeur + partenaire, téléphone/email) partaient sur le fil pour quiconque tient un lien `ref`, sans authentification — contrairement au legacy, dont le back pré-formatait volontairement une réponse minimale pour ces deux pages (`chauffeur.html`/`dashboard.html`, `driverName`/`clientName`/`pickupDate`/… seulement, aucun prix). Ce n'était pas un bug introduit cette session : l'endpoint existait déjà ainsi. Traité comme un vrai problème de sécurité à corriger avant de construire les pages, pas après (voir `[[feedback-fix-all-bugs-found]]`).

Le flux SSE (`GET /api/events/stream`, `apps/api/src/realtime/`) était lui aussi déjà construit pour Bookings, mais gardé par la session par défaut (`SessionAuthGuard` global) — jamais rendu public puisque jamais consommé hors app authentifiée jusqu'ici.

## Ce qui a changé

### Back — redaction de la projection publique

- `apps/api/src/trips/dto/public-trip.entity.ts` (nouveau) — `PublicTripEntity` : `ref`/`tracking`/`assignmentCancelled`/`clientName`/`clientRef`/`driverName`/`passengerName`/`paxCount`/`pocName`/`pocPhone`/`pickupAt`/`timezone`/`pickupLocation`/`dropoffLocation`/`vehicleTypeName`/`instructions`/`steps` — aucun prix, aucun `client`/`driver` brut. `PublicTripActionResponseEntity` (même redaction pour la réponse de `notify()`).
- `apps/api/src/trips/public-trip.mapper.ts` (nouveau) — `toPublicTrip(trip, viewerIsDriver)`, fonction pure (même style que `trip-message.util.ts`'s `buildTripMessageContext`) : `pocName`/`pocPhone`/`instructions` ne sont peuplés que pour la vue chauffeur (`viewerIsDriver`), `null` pour la vue tracking client — même distinction que le legacy entre `chauffeur.html` (POC visible) et `dashboard.html` (POC caché).
- `TripsService.getPublic()`/`notify()` — retournent désormais `PublicTripEntity`/`PublicTripActionResponseEntity` au lieu de `TripEntity`/`TripActionResponseEntity`. `getPublic` reste la seule méthode gardée par `@Public()` à null-ifier conditionnellement selon `viewerIsDriver` ; `notify()` (chauffeur uniquement) mappe toujours en vue chauffeur.
- `RealtimeController.stream()` — `@Public()` ajouté. Le payload SSE (`{type:'trip-changed', ref}`) ne contenant aucune donnée sensible, l'ouvrir à tout porteur d'un lien ne crée aucune fuite ; c'était uniquement gardé par défaut jusqu'ici, jamais un choix délibéré.
- **Bug de concurrence trouvé et corrigé pendant la vérification navigateur** (pas dans le scope initial, corrigé immédiatement, cf. `[[feedback-fix-all-bugs-found]]`) : `getPublic()`'s auto-stamp TRANSMITTED/RECEIVED (`prisma.tripStep.createMany`) n'était pas idempotent — deux ouvertures quasi simultanées du lien chauffeur (le double-invoke d'effet de React StrictMode en dev le déclenche de façon fiable, un lien avec une connexion flaky aussi) peuvent toutes les deux lire "RECEIVED absent" et tenter l'insertion : `@@unique([tripId, step])` sur `TripStep` fait échouer la perdante avec une 500 brute. Reproduit en vrai contre le stack dev (chrome-devtools MCP) avant d'être compris — voir capture réseau `reqid=281` dans la session. Fix : `skipDuplicates: true` sur le `createMany`. Test de régression ajouté (`trips.e2e-spec.ts`, "two concurrent opens…") — vérifié qu'il échoue sans le fix (P2002 → 500) et passe avec.

### Front — nouveau dossier `apps/web/src/features/public-tracking/`

- `driver-page.tsx` (`/driver/:ref`, ex-`chauffeur.html`) — 2 étapes auto en lecture seule (Transmitted/Received) + 5 boutons d'étape (Accepted/Enroute/Arrived/Onboard/Dropped), bandeau "tracking désactivé" si `!trip.tracking`, infos POC visibles.
- `track-page.tsx` (`/track/:ref`, ex-`dashboard.html`) — lecture seule, 4 étapes seulement (pas d'Enroute, fidèle au legacy), aucune info POC/instructions, point vert pulsant "live tracking".
- `use-public-trip-events.ts` — pendant public de `bookings/use-trip-events.ts` : même flux SSE, mais filtré côté client sur le `ref` de la page et `refetch()` de la query publique plutôt qu'invalidation de la liste dispatcher.
- `public-trip-ui.tsx` — `PublicPageShell`/`PublicPageEmpty`/`InfoRow`/`StepIcon`, petits composants de présentation partagés entre les deux pages (mobile-first, `bg-primary`/tokens Tailwind existants — pas de reprise du CSS artisanal legacy, cohérent avec le reste du plan).
- `retry-public-query.ts` — **écart délibéré par rapport au comportement global** : `lib/query-client.ts` a `retry:false` partout (une 401 doit rediriger vers `/login`, pas réessayer), mais ces deux pages n'ont ni login ni aucun autre mode d'erreur à gérer. `retryPublicQuery` réessaie 2 fois sur toute erreur *sauf* un 4xx (un ref vraiment invalide doit encore échouer immédiatement, pas après 2 backoffs) — sans ça, ces pages étaient **moins résilientes que le polling bête du legacy** face à un aléa réseau transitoire (identifié en même temps que le bug de concurrence ci-dessus, pendant la même vérification navigateur).
- `router.tsx` — deux routes top-level `/driver/:ref`/`/track/:ref`, en dehors du `<AppShell>`/`requireAuth` (pas de nav, pas de session).

## Tests

- **Backend e2e** (`trips.e2e-spec.ts`) : redaction (prix/VAT/`client`/`driver` bruts absents en vue track et driver), POC/instructions présents en vue driver seulement, réponse de `notify()` également redigée, régression concurrence (2 GET simultanés → 200/200, un seul step de chaque type).
- **Backend e2e** (`realtime.e2e-spec.ts`) : réécrit — testait "401 sans session", teste maintenant l'inverse (`@Public()` intentionnel) via un socket brut (supertest bufferise indéfiniment sur un flux SSE qui ne se termine jamais).
- **Playwright** (`public-trip-lifecycle.spec.ts`) : scénario complet — création via API (fixtures seed Marc Dubois/Julien Petit), **cookies de session explicitement effacés** avant de naviguer sur les deux pages (le point entier de ces pages), capture réseau des deux vues pour vérifier la redaction sur le vrai payload (pas seulement l'absence de rendu), parcours des 5 boutons chauffeur, second onglet `/track/:ref` (également sans cookie) qui reçoit la mise à jour **sans reload** via SSE, cas ref inconnu.
- **Frontend unit** : aucun ajout — ces deux pages sont des compositions "vivantes" (query+mutation+SSE), même choix que pour les vérticales précédentes de laisser Playwright + vérification navigateur couvrir ce niveau plutôt que des tests unitaires avec hooks mockés.

## Résultats finaux

- `pnpm --filter @cockpit/api test` → **27/27** (inchangé)
- `pnpm --filter @cockpit/api test:e2e` → **117/117** (+1 vs session précédente : régression concurrence)
- `pnpm --filter @cockpit/web test` → **267/267** (inchangé)
- `pnpm --filter @cockpit/web exec tsc --noEmit -p tsconfig.app.json` → propre
- `pnpm --filter @cockpit/web lint` → 8 warnings, tous préexistants (même baseline)
- `pnpm --filter @cockpit/web exec playwright test` → **23/25** (2 échecs dans `planning-lifecycle.spec.ts`, **préexistants et sans rapport** — drag&drop flaky déjà présent avant cette session, reproduit à l'identique avant/après mes changements ; non traité, hors scope)
- Vérification manuelle au navigateur (chrome-devtools MCP), **onglets isolés sans cookie** : `/driver/:ref` (parcours des 5 boutons), `/track/:ref` dans un second onglet isolé recevant la mise à jour en direct sans reload. C'est cette vérification qui a fait remonter le bug de concurrence ci-dessus (500 visible dans la console, capturé et compris via le réseau devtools) — depuis re-vérifié résolu par un stress test à 5 requêtes concurrentes contre le stack dev réel.

## Environnement pour reprendre

`docker compose` (dev, 5173/3000) up, aucun rebuild nécessaire (aucune nouvelle dépendance cette session, l'API a rechargé à chaud sur le fix de concurrence).

Données laissées dans la base dev (non nettoyées, cohérent avec les sessions précédentes) : plusieurs trips de vérification manuelle pour le client CI1/chauffeur Julien Petit (`R-CI1-26-2`, `R-CI1-26-6`, refs suivantes).

**Prochaine étape suggérée** : `/finance` (stub) est désormais le seul élément restant de `docs/FRONTEND_PLAN.md`.

# Cockpit v2 — Plan Frontend (React + TypeScript + Tailwind)

> Document vivant : la section "État actuel" ci-dessous est la version en vigueur. Tout changement de cap s'ajoute au **Journal** en bas du fichier, jamais en réécrivant l'historique.

## État actuel

### Contexte de décision

Issu d'une session de cadrage (2026-08-26) : le choix exact entre React/Vue a été délégué ("peu importe, là où tu as le plus de références"), avec une exigence ferme : **Tailwind CSS**. SSE retenu pour le temps réel (fin du polling 5s du legacy). Voir `LEGACY_FEATURES.md` §10 pour l'inventaire complet des pages/comportements à reproduire.

### Stack

- **Monorepo pnpm** : `apps/web` (Vite + React + TypeScript + Tailwind), partage de types/schémas Zod avec `apps/api` via `packages/shared`.
- **UI kit** : Tailwind + shadcn/ui (composants Radix headless stylés Tailwind).
- **Routing** : React Router.
- **Data fetching/cache** : TanStack Query.
- **Formulaires** : React Hook Form + Zod (schémas partagés avec les DTOs NestJS via `packages/shared`).
- **Temps réel** : hook `useTripEvents()` sur un flux SSE (`/api/events/stream`), invalide le cache TanStack Query correspondant à la réception d'un événement.

### Pages (mappées depuis l'inventaire legacy)

Authentifiées :
- `/login` — email+mot de passe puis code 2FA (un compte par utilisateur, plus un seul compte admin partagé comme au legacy).
- `/bookings` (ex-`dispatcher.html`) — barre de création de course + listes Local/Farm out.
- `/clients`, `/drivers`, `/vehicles` — CRUD + popups d'édition/indisponibilité, mêmes règles conditionnelles que le legacy.
- `/planning` — toggle chauffeurs/véhicules, vue liste + vue timeline Gantt drag&drop.
- `/events` — sélection/création de compte événement + "Create bulk".
- `/invoicing` — onglets Customer/Driver log/Partner log/History.
- `/finance` — stub pour l'instant.
- `/settings` (ex-`owner.html`) — infos société + gestion des utilisateurs (remplace le panneau "Access" décoratif du legacy par une vraie gestion de comptes).

Publiques (sans auth, comme le legacy) :
- `/driver/:ref` (ex-`chauffeur.html`) — page mobile chauffeur, 5 boutons d'étape.
- `/track/:ref` (ex-`dashboard.html`) — suivi client en lecture seule, **SSE au lieu de polling 5s**.

### Composants partagés à recréer (équivalents `common.js`)

- Combobox recherche (pays, référence client/chauffeur, POC, adresse via géocodage).
- `RecordDialog` — popup générique d'édition/création (remplace `openRecordModal`).
- Popup de confirmation générique.
- Timeline Gantt réutilisable (planning chauffeurs/véhicules), drag&drop d'assignation.
- Hint devise/FX (taux de change live).
- Popup infos vol (vérification FlightStats).
- Popups indisponibilité chauffeur/véhicule.

### Branding

Réutilisation des assets existants (`cockpit-icon.webp`, `cockpit-wordmark.png`), palette verte "WhatsApp" du legacy comme point de départ (`--green:#128C7E`), adaptée en tokens Tailwind (`theme.extend.colors`).

---

## Journal

> **2026-08-26 — Version initiale.** Issue de la session de cadrage (grilling) : React + TypeScript + Tailwind (choix du framework délégué, Tailwind imposé), monorepo pnpm partagé avec le backend, SSE pour remplacer le polling 5s legacy, pages mappées 1:1 depuis l'inventaire `LEGACY_FEATURES.md`.

> **2026-08-26 — Lancement de l'implémentation (grilling #2).** Le back (`apps/api`) est déjà largement implémenté (Auth/Users/Company/Meta/Clients/Drivers/Fleet/Notifications/Geo/Trips/Invoices/Realtime, tous testés e2e) ; `apps/web` était encore un scaffold Vite par défaut. Décisions de cadrage avant de coder :
> - **Ordre** : verticale complète d'abord (`/login` + `/bookings`, page la plus centrale du legacy `dispatcher.html`) plutôt qu'un scaffold en largeur de toutes les pages. Les autres pages authentifiées/publiques suivront en itérations séparées.
> - **Partage de types front/back** : le back utilise `class-validator` (pas Zod) et n'exposait aucun OpenAPI. Ajout de `@nestjs/swagger` sur les DTOs existants (non-invasif) + génération d'un client typé dans `packages/shared`, plutôt que des types dupliqués à la main ou rien de partagé — élimine le risque de dérive.
> - **Ajouts back additifs** décidés pour débloquer le front : `GET /api/auth/me` (identité + rôle courant, absent jusqu'ici, nécessaire pour le nav rôle-gated) et un provider WhatsApp "dev" (log console) sélectionné automatiquement quand `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` sont absents — sans ça, Dispatch/Notify/Advance-step (qui appellent `TwilioWhatsAppProvider`, codé en dur, sans fallback) seraient impossibles à tester en local.
> - **Données de test** : `prisma/seed-data.ts` étendu avec des clients/chauffeurs/véhicules flotte d'exemple (le seed actuel ne créait que l'admin + pays + types de véhicule ; le formulaire de course n'autorise aucune création à la volée).
> - **Fidélité legacy** : comportement/règles métier reproduits fidèlement (voir `LEGACY_FEATURES.md`), UI entièrement redessinée en shadcn/ui (pas de copie pixel du CSS artisanal legacy), accent vert de marque (`#128C7E`) conservé.
> - **Périmètre de la verticale bookings** : tout inclus dès cette passe — barre de création, tableaux Local/Farm out + filtres, popups d'édition rapide, annulation avec mot de passe manager (vérifie le mot de passe de l'utilisateur courant via `verify-password`, plus un secret partagé unique comme au legacy), dispatch-driver + advance-step (workflow de statut complet), upload nameboard, popup vérif vol (FlightStats, dégradé proprement si non configuré) et hint FX/marge live.
> - **Tests** : suite complète Vitest + Testing Library sur la logique à risque (règles de validation conditionnelles, machine à états du workflow de statut) + Playwright e2e sur le parcours création→dispatch→statuts, au même niveau de rigueur que les tests e2e déjà en place côté back.
> - **Dev workflow** : stack `docker compose up` (Postgres+api+web) utilisée pendant toute l'implémentation, vérification systématique au navigateur (pas seulement via les tests) avant de considérer un écran terminé.

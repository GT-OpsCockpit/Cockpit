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

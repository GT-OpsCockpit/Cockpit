# Cockpit v2 — Plan DevOps (Docker, CI/CD, infra)

> Document vivant : la section "État actuel" ci-dessous est la version en vigueur. Tout changement de cap s'ajoute au **Journal** en bas du fichier, jamais en réécrivant l'historique.

## État actuel

### Contexte de décision

Issu d'une session de cadrage (2026-08-26) : pas d'infra existante réutilisable pour Cockpit (VPS à provisionner de zéro), tout doit être dockerisé, dépôt sur GitHub privé séparé du legacy.

### Structure

- **Monorepo pnpm** (`apps/api`, `apps/web`, `packages/shared`), un `Dockerfile` multi-stage par app (`apps/web` compilé en statique, servi derrière Caddy).
- **`docker-compose.yml`** (prod) : services `postgres` (volume persistant + backup), `api` (NestJS), `web` (statique), `caddy` (reverse-proxy, HTTPS auto, sert `web`, proxy `/api` et `/api/events/stream` vers `api`).
- **`docker-compose.override.yml`** (dev local) : hot-reload, ports exposés, un outil d'inspection DB (pgweb ou pgAdmin).

### CI/CD (GitHub Actions)

- Sur PR → install (pnpm), lint, typecheck, tests (Jest pour `api`, Vitest pour `web`) contre un service Postgres éphémère.
- Sur merge `main` → build + push des images Docker sur GHCR, taguées au SHA du commit.
- Déploiement : job manuel (ou déclenché sur tag) qui se connecte en SSH au VPS et exécute `docker compose pull && docker compose up -d`.

### Hébergement

- **VPS neuf recommandé en zone EU** (Hetzner ou OVH — résidence des données FR/RGPD, cohérent avec des données de clients/chauffeurs français).
- **Secrets** : GitHub Actions secrets pour le registry + la clé SSH du VPS ; secrets runtime (DB, JWT, Twilio, SMTP) dans un `.env` non commité sur le VPS, chargé via `env_file` dans docker-compose.
- **Sauvegardes** : `pg_dump` nocturne (cron sur le VPS) + copie hors-site (rclone vers stockage S3-compatible) — corrige à un niveau supérieur la leçon du legacy (zéro persistance) : zéro sauvegarde serait la même erreur, un cran plus haut.

### Dépôt

- `gh repo create cockpit-v2 --private`, remote sous le compte GitHub de l'utilisateur, repo séparé du legacy (`suivi-chauffeur-twilio` reste intact, non touché).

---

## Journal

> **2026-08-26 — Version initiale.** Issue de la session de cadrage (grilling) : Docker de bout en bout, VPS neuf (EU recommandé), GitHub privé séparé du legacy, CI GitHub Actions (lint/typecheck/test puis build+push d'images), sauvegardes Postgres explicitement prévues pour ne pas reproduire l'erreur de non-persistance du legacy à un niveau supérieur.

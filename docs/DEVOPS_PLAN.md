# Cockpit v2 — Plan DevOps (Docker, CI/CD, infra)

> Document vivant : la section "État actuel" ci-dessous est la version en vigueur. Tout changement de cap s'ajoute au **Journal** en bas du fichier, jamais en réécrivant l'historique.

## État actuel

### Contexte de décision

Issu d'une session de cadrage (2026-08-26) : pas d'infra existante réutilisable pour Cockpit (VPS à provisionner de zéro), tout doit être dockerisé, dépôt sur GitHub privé séparé du legacy.

### Structure

- **Monorepo pnpm** (`apps/api`, `apps/web`, `packages/shared`), un `Dockerfile` multi-stage par app avec 3 cibles : `dev` (serveur de dev, utilisé en local), `build` (stage intermédiaire), `prod` (image minimale — `node dist/src/main.js` pour `api`, bundle statique servi par `nginx:1.31.4-alpine3.24` pour `web`, avec fallback SPA). C'est la cible `prod` qui est buildée et poussée par CI.
- **`docker-compose.yml`** (prod, à la racine) : services `postgres` (volume persistant), `api`, `web` référencés par `image:` (Docker Hub), pas de `build:`. `web` exposé en `8080:80` en attendant Caddy (pas encore ajouté).
- **`docker-compose.override.yml`** (dev local, auto-chargé par `docker compose` à côté du fichier précédent) : `build:` (cible `dev`) + bind-mounts ciblés sur les fichiers sources (`src/`, pas tout le dossier — évite le piège classique des `node_modules` de conteneur écrasés par ceux de l'hôte) → vrai hot-reload testé et validé (Nest `--watch` + Vite HMR). Postgres exposé sur `5432` uniquement en dev.
- Backup Postgres, `caddy` et outil d'inspection DB (pgweb/pgAdmin) : pas encore faits, cf. Journal.

### CI/CD (GitHub Actions)

Trois workflows dans `.github/workflows/` :

- **`ci.yml`** — sur PR et push `main` : install (pnpm), `prisma generate`, lint + build (typecheck) + test (Jest pour `api`, Vitest pour `web`) contre un service Postgres éphémère. Testé de bout en bout localement avant commit.
- **`build-push.yml`** — sur push `main` : build (cible `prod`) + push des deux images sur **Docker Hub** (pas GHCR, cf. Journal), taguées au SHA court + `latest`. Namespace : `gtopscockpit`. Nécessite les secrets/vars repo `DOCKERHUB_USERNAME` (variable) et `DOCKERHUB_TOKEN` (secret) — **pas encore configurés**.
- **`deploy.yml`** — manuel (`workflow_dispatch`, tag d'image optionnel) ou sur tag `v*` : SSH vers le VPS (`appleboy/ssh-action`), `docker compose pull && up -d`. Nécessite les secrets `VPS_HOST`, `VPS_USERNAME`, `VPS_SSH_KEY`, `VPS_PORT` et un dossier `~/cockpit` sur le VPS avec `docker-compose.yml` + `.env` — **rien de tout ça n'existe encore**, ce workflow est une coquille qui échouera si déclenché avant provisioning.

### Hébergement

- **VPS neuf recommandé en zone EU** (Hetzner ou OVH — résidence des données FR/RGPD, cohérent avec des données de clients/chauffeurs français).
- **Secrets** : GitHub Actions secrets pour le registry + la clé SSH du VPS ; secrets runtime (DB, JWT, Twilio, SMTP) dans un `.env` non commité sur le VPS, chargé via `env_file` dans docker-compose.
- **Sauvegardes** : `pg_dump` nocturne (cron sur le VPS) + copie hors-site (rclone vers stockage S3-compatible) — corrige à un niveau supérieur la leçon du legacy (zéro persistance) : zéro sauvegarde serait la même erreur, un cran plus haut.

### Dépôt

- `gh repo create cockpit-v2 --private`, remote sous le compte GitHub de l'utilisateur, repo séparé du legacy (`suivi-chauffeur-twilio` reste intact, non touché).

---

## Journal

> **2026-08-26 — Version initiale.** Issue de la session de cadrage (grilling) : Docker de bout en bout, VPS neuf (EU recommandé), GitHub privé séparé du legacy, CI GitHub Actions (lint/typecheck/test puis build+push d'images), sauvegardes Postgres explicitement prévues pour ne pas reproduire l'erreur de non-persistance du legacy à un niveau supérieur.

> **2026-08-26 — Base + CI/CD scaffoldés.** Monorepo installé et les 3 services (front/back/DB) démarrent en dev (validé par rebuild à froid). Ajout du split `docker-compose.yml`/`docker-compose.override.yml` et du hot-reload dev (bind-mounts ciblés, pas tout le dossier — le piège des `node_modules` de conteneur écrasés a été anticipé). Dockerfiles passés en multi-stage (`dev`/`build`/`prod`), les 2 images `prod` buildées et testées manuellement en local (pas seulement `docker build`, aussi lancées et vérifiées vivantes). **Registre changé de GHCR (prévu initialement) vers Docker Hub** sur demande explicite, namespace `gtopscockpit`. Les 3 workflows GitHub Actions sont écrits et la CI a été rejouée intégralement en local avant commit ; `build-push.yml` et `deploy.yml` ne peuvent pas encore s'exécuter réellement : ni les secrets Docker Hub (`DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN`) ni le VPS (`VPS_HOST`/`VPS_USERNAME`/`VPS_SSH_KEY`) n'existent — décision explicite de l'utilisateur de garder la structure en place et de la câbler plus tard. À noter aussi : le remote GitHub réel est `GT-OpsCockpit/Cockpit` (pas `cockpit-v2` comme indiqué plus haut dans "Dépôt" — divergence mineure, repo déjà créé avant cette session).

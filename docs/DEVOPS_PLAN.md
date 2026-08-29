# Cockpit v2 — Plan DevOps (Docker, CI/CD, infra)

> Document vivant : la section "État actuel" ci-dessous est la version en vigueur. Tout changement de cap s'ajoute au **Journal** en bas du fichier, jamais en réécrivant l'historique.

## État actuel

### Contexte de décision

Issu d'une session de cadrage (2026-08-26) : pas d'infra existante réutilisable pour Cockpit (VPS à provisionner de zéro), tout doit être dockerisé, dépôt sur GitHub privé séparé du legacy.

### Structure

- **Monorepo pnpm** (`apps/api`, `apps/web`, `packages/shared`), un `Dockerfile` multi-stage par app avec 3 cibles : `dev` (serveur de dev, utilisé en local), `build` (stage intermédiaire), `prod` (image minimale — `node dist/src/main.js` pour `api`, bundle statique servi par `nginx:1.31.4-alpine3.24` pour `web`, avec fallback SPA). C'est la cible `prod` qui est buildée et poussée par CI.
- **`docker-compose.yml`** (prod, à la racine) : services `postgres` (volume persistant), `minio` (volume persistant), `api`, `web` référencés par `image:` (Docker Hub), pas de `build:`. `web` exposé en `8080:80` en attendant Caddy (pas encore ajouté).
- **`docker-compose.override.yml`** (dev local, auto-chargé par `docker compose` à côté du fichier précédent) : `build:` (cible `dev`) + bind-mounts ciblés sur les fichiers sources (`src/`, pas tout le dossier — évite le piège classique des `node_modules` de conteneur écrasés par ceux de l'hôte) → vrai hot-reload testé et validé (Nest `--watch` + Vite HMR). Postgres (`5432`) et MinIO (`9000`/`9001`) exposés sur l'hôte uniquement en dev.
- Backup Postgres, `caddy` et outil d'inspection DB (pgweb/pgAdmin) : pas encore faits, cf. Journal.

### Stockage de fichiers (uploads)

- **MinIO** (implémentation S3 open-source, image officielle pinnée) auto-hébergé comme service compose, en prod **et** en dev, avec volume nommé `minio_data` — même schéma de persistance que `postgres_data`. Remplace l'écriture Multer `diskStorage` sur le disque du container `api`, qui n'avait aucun volume monté : tout fichier uploadé disparaissait au premier redéploiement alors que `trip.nameboardUrl` continuait de pointer dessus (lien mort silencieux — la même erreur de non-persistance que le legacy, un cran plus haut).
- Code applicatif **générique et sans provider hardcodé** : un `StorageService` (`apps/api/src/common/storage/`, `@aws-sdk/client-s3` + `@aws-sdk/lib-storage`) piloté uniquement par les variables `S3_ENDPOINT` / `S3_REGION` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` / `S3_FORCE_PATH_STYLE`. Passer à un vrai provider (AWS/OVH/Scaleway) = changer ces variables et retirer le service `minio`, **zéro changement de code**.
- **Bucket privé, jamais exposé sur internet** (pas de Caddy/TLS aujourd'hui) : l'API proxifie la lecture. Un seul bucket partagé par toutes les features, clés préfixées par feature (`nameboards/<uuid>.ext`) ; en revanche **chaque feature expose sa propre route de lecture** avec ses propres règles d'accès (`NameboardController`, publique, hors préfixe `/api`) — une route générique `/uploads/:key` deviendrait une fuite de données dès qu'une feature stockera des fichiers à accès restreint.
- L'API réutilise directement le compte root MinIO (`MINIO_ROOT_USER`/`PASSWORD` → `S3_ACCESS_KEY`/`SECRET_KEY`), comme elle réutilise `POSTGRES_USER`/`PASSWORD` : une seule instance, un seul consommateur, pas de compte de service restreint pour l'instant.
- Buckets séparés par environnement : `cockpit-uploads` (prod, défaut), `cockpit-uploads-dev`, `cockpit-uploads-test`. Le bucket est créé au boot de l'API (`CreateBucket` idempotent) ; si MinIO est injoignable, l'API **refuse de démarrer** plutôt que de tourner avec un stockage silencieusement cassé.
- Conséquence pour le dev : MinIO doit tourner localement pour lancer l'API ou la suite e2e, au même titre que Postgres. La CI n'est pas concernée (elle ne joue que les tests unitaires).

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

> **2026-08-29 — Uploads migrés du disque du container vers un stockage S3 (MinIO auto-hébergé).** Correction du dernier point de non-persistance restant : les pancartes (`POST /trips/:ref/nameboard`) étaient écrites par Multer sur le filesystem du container `api`, sans volume monté — perdues à chaque redéploiement, avec un `trip.nameboardUrl` en base pointant dans le vide. Ajout d'un service `minio` (volume `minio_data`, healthcheck, ports publiés en dev seulement) et d'un `StorageService` générique piloté uniquement par des variables `S3_*`, pour que le passage à un vrai provider soit un changement de config et pas de code. Le bucket restant privé, l'API proxifie la lecture via `NameboardController` (exclu du préfixe `/api`) : la forme d'URL `/uploads/nameboards/<fichier>` est inchangée, donc **aucun changement côté frontend ni en base**. Au passage, `setNameboard()` supprime maintenant l'ancien objet lors d'un remplacement (best-effort) — bug latent déjà présent sur disque, où l'ancien fichier n'était jamais nettoyé. Vérifié de bout en bout : bucket auto-créé au boot, e2e complet vert (163 tests), upload réel via le container puis `docker compose up -d --force-recreate api` → fichier toujours servi, ce qui était précisément le bug.

> **2026-08-29 — Image `prod` de l'API réparée (bug pré-existant, découvert en vérifiant le point précédent).** L'image `prod` buildait mais mourait au démarrage sur `MODULE_NOT_FOUND @cockpit/shared` : le stage `prod` ne copiait que `dist`, `generated` et `prisma`, alors que `@cockpit/shared` publie du TypeScript brut (ses `exports` pointent sur `src/*.ts`, ce que consomment Vite et ts-jest en dev) et que le `dist` compilé le `require` au runtime. Reproduit à l'identique sur le commit `a88775e` avant toute modification de cette session, donc antérieur — le `deploy.yml` aurait échoué au premier vrai déploiement. Corrigé par un `COPY packages/shared/src` dans le stage `prod` (Node 22 strippe les types au chargement). L'image démarre maintenant et répond (routes montées, 401 sans session, 404 propre sur un fichier absent).

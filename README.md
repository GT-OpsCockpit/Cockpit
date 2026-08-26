# Cockpit v2

Réécriture de l'app de dispatching VTC "Cockpit" (legacy : `suivi-chauffeur-twilio`, prototype Node/Express en mémoire, non touché, gardé comme référence).

## Documents fondateurs

Avant tout code, la direction du projet est posée dans 4 documents vivants (mis à jour en journal, jamais réécrits par-dessus leur historique) :

- [`docs/LEGACY_FEATURES.md`](docs/LEGACY_FEATURES.md) — inventaire exhaustif de l'app legacy (modèles, routes, règles métier, pages, dette technique).
- [`docs/BACKEND_PLAN.md`](docs/BACKEND_PLAN.md) — architecture NestJS + modèles de données PostgreSQL/Prisma.
- [`docs/FRONTEND_PLAN.md`](docs/FRONTEND_PLAN.md) — architecture React + TypeScript + Tailwind.
- [`docs/DEVOPS_PLAN.md`](docs/DEVOPS_PLAN.md) — Docker, CI/CD, infra.

## État du projet

Phase actuelle : base technique + CI/CD scaffoldés. `apps/api` (NestJS + Prisma 7/PostgreSQL via `@prisma/adapter-pg`), `apps/web` (Vite + React + TypeScript + Tailwind v4) et `packages/shared` sont scaffoldés en monorepo pnpm ; aucun endpoint métier ni logique n'a encore été ajouté.

### Lancer en dev (hot-reload)

```bash
cp .env.example .env   # ajuster si besoin
docker compose up --build
```

`docker compose` charge automatiquement `docker-compose.yml` + `docker-compose.override.yml` : build local (cible `dev` du Dockerfile), bind-mounts sur les sources → les changements sur `apps/api/src`, `apps/web/src`, etc. sont pris en compte à chaud (Nest `--watch` / Vite HMR), sans rebuild.

- API : http://localhost:3000
- Web : http://localhost:5173
- Postgres : localhost:5432 (user/db `cockpit`)

### CI/CD

Trois workflows dans `.github/workflows/` (détail dans `docs/DEVOPS_PLAN.md`) :

- `ci.yml` — lint/build/test sur PR et push `main`, déjà fonctionnel.
- `build-push.yml` — build les images cible `prod` et les pousse sur Docker Hub (`gtopscockpit/cockpit-api`, `gtopscockpit/cockpit-web`) sur push `main`.
- `deploy.yml` — déploiement manuel sur le VPS par SSH.

**Ces deux derniers ne peuvent pas encore tourner** : il manque les secrets/vars GitHub (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `VPS_HOST`, `VPS_USERNAME`, `VPS_SSH_KEY`) et le VPS lui-même n'est pas provisionné. `docker-compose.yml` (sans l'override, celui utilisé en prod) attend un dossier `~/cockpit` sur le VPS avec ce fichier + un `.env` réel.

Prochaine étape : implémenter le modèle de données Prisma et les premiers modules NestJS décrits dans `docs/BACKEND_PLAN.md`.

<div align="center">

# Cockpit v2

**Dispatching VTC** — réécriture de l'app "Cockpit" (legacy : `suivi-chauffeur-twilio`,
prototype Node/Express en mémoire, gardé en lecture seule comme référence).

[![CI](https://github.com/GT-OpsCockpit/Cockpit/actions/workflows/ci.yml/badge.svg)](https://github.com/GT-OpsCockpit/Cockpit/actions/workflows/ci.yml)
![Legacy parity](https://img.shields.io/badge/legacy_parity-complete-brightgreen?style=flat-square)
![WhatsApp CTA](https://img.shields.io/badge/WhatsApp_CTA-planned-yellow?style=flat-square)

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

</div>

---

## État du projet

Toutes les pages authentifiées et publiques du plan initial sont construites et en parité de
logique métier avec le legacy (voir [`docs/LEGACY_PARITY_AUDIT.md`](docs/LEGACY_PARITY_AUDIT.md)).
Il ne reste qu'un chantier non démarré : l'intégration WhatsApp à boutons CTA, cadrée dans
[`docs/WHATSAPP_CTA_PLAN.md`](docs/WHATSAPP_CTA_PLAN.md).

| Composant | Stack | Rôle |
|---|---|---|
| `apps/api` | NestJS · Prisma 7 · PostgreSQL (`@prisma/adapter-pg`) | API métier, auth, permissions, notifications |
| `apps/web` | Vite · React · TypeScript · Tailwind v4 · shadcn/ui | Interface dispatcher |
| `packages/shared` | TypeScript / JS partagé | Schémas, validation, calculs métier partagés front/back |
| Infra | Docker Compose · MinIO (S3) · GitHub Actions | Dev + CI/CD, uploads en stockage compatible S3 |

## Démarrage rapide

```bash
cp .env.example .env   # ajuster si besoin
docker compose up --build
```

`docker compose` charge automatiquement `docker-compose.yml` + `docker-compose.override.yml` :
build local (cible `dev` du Dockerfile), bind-mounts sur les sources → les changements sur
`apps/api/src`, `apps/web/src`, etc. sont pris en compte à chaud (Nest `--watch` / Vite HMR),
sans rebuild.

| Service | URL |
|---|---|
| API | http://localhost:3000 |
| Web | http://localhost:5173 |
| Postgres | `localhost:5432` (user/db `cockpit`) |
| MinIO (uploads) | API S3 sur `:9000`, console sur http://localhost:9001 (`minioadmin`/`minioadmin`) |

Pièges connus (régénération après un changement de schéma/DTO, outillage navigateur, comparaison
avec le legacy) : [`docs/agents/dev-environment.md`](docs/agents/dev-environment.md).

## Vérifier avant de livrer

```bash
cd apps/api && pnpm exec tsc --noEmit -p tsconfig.json && pnpm exec eslint "src/**/*.ts" "test/**/*.ts" && pnpm exec jest && pnpm test:e2e
cd apps/web && pnpm exec tsc --noEmit -p tsconfig.app.json && pnpm exec vitest run && pnpm exec playwright test
```

Méthode "rouge d'abord" et politique zéro test mort/désactivé : [`docs/agents/testing.md`](docs/agents/testing.md).

## CI/CD

Trois workflows dans `.github/workflows/` :

| Workflow | Déclencheur | Rôle |
|---|---|---|
| `ci.yml` | PR + push `main` | Lint, build, tests |
| `build-push.yml` | push `main` | Build les images `prod` et les pousse sur Docker Hub (`gtopscockpit/cockpit-api`, `gtopscockpit/cockpit-web`) |
| `deploy.yml` | manuel | Déploiement SSH sur le VPS (secrets requis : voir les commentaires du fichier) |

## Pour un agent qui reprend ce repo

Commencer par [`CLAUDE.md`](CLAUDE.md) — c'est le point d'entrée : règles de code, workflow, et
pointeurs vers le reste. En particulier :

- [`docs/LEGACY_PARITY_AUDIT.md`](docs/LEGACY_PARITY_AUDIT.md) — le référentiel vivant de tout
  écart de logique métier entre le legacy et v2 : ce qui est une régression (à corriger), ce qui
  est un écart assumé, ce qui est une modernisation documentée.
- [`docs/LEGACY_FEATURES.md`](docs/LEGACY_FEATURES.md) — inventaire exhaustif de l'app legacy
  (modèles, routes, règles métier, pages, dette technique), utile pour toute question "que faisait
  le legacy ici".
- [`docs/WHATSAPP_CTA_PLAN.md`](docs/WHATSAPP_CTA_PLAN.md) — le seul chantier encore devant nous.
- [`docs/adr/`](docs/adr/) — décisions d'architecture qui ne se redécident pas à chaque session
  (pagination, devises, stockage, encapsulation WhatsApp, règles métier côté serveur).
- [`docs/agents/`](docs/agents/) — domaine, permissions, tests, environnement de dev, prompt de
  passe QA.

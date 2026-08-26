# Cockpit v2

Réécriture de l'app de dispatching VTC "Cockpit" (legacy : `suivi-chauffeur-twilio`, prototype Node/Express en mémoire, non touché, gardé comme référence).

## Documents fondateurs

Avant tout code, la direction du projet est posée dans 4 documents vivants (mis à jour en journal, jamais réécrits par-dessus leur historique) :

- [`docs/LEGACY_FEATURES.md`](docs/LEGACY_FEATURES.md) — inventaire exhaustif de l'app legacy (modèles, routes, règles métier, pages, dette technique).
- [`docs/BACKEND_PLAN.md`](docs/BACKEND_PLAN.md) — architecture NestJS + modèles de données PostgreSQL/Prisma.
- [`docs/FRONTEND_PLAN.md`](docs/FRONTEND_PLAN.md) — architecture React + TypeScript + Tailwind.
- [`docs/DEVOPS_PLAN.md`](docs/DEVOPS_PLAN.md) — Docker, CI/CD, infra.

## État du projet

Phase actuelle : documentation/cadrage. Le code applicatif (`apps/api`, `apps/web`, `packages/shared`) n'a pas encore été initialisé — ce sera l'objet d'une prochaine étape, une fois ces 4 documents relus et validés.

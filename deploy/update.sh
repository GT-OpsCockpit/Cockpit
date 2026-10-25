#!/usr/bin/env bash
# Deploys the code currently on the server: pull, rebuild, migrate, restart.
# Usage:  ./update.sh            (deploys the checked-out branch, after a pull)
#         ./update.sh <branch>   (switches to that branch first)
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "Missing deploy/.env — copy .env.example and fill it in."; exit 1; }
if [ -n "${1:-}" ]; then git fetch origin && git checkout "$1"; fi
git pull --ff-only

echo "Deploying commit: $(git log --oneline -1)"
COMPOSE=(docker compose -f docker-compose.prod.yml)

# Safety net: a fresh backup right before touching the database.
if "${COMPOSE[@]}" ps --status running postgres 2>/dev/null | grep -q postgres; then ./backup.sh || echo "WARNING: backup failed — continuing."; fi

"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d postgres minio
"${COMPOSE[@]}" run --rm migrate
"${COMPOSE[@]}" up -d
# Caddy reads its config file only at start, and `up -d` leaves it running when
# only the Caddyfile changed: reload it so edits take effect.
"${COMPOSE[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile
docker image prune -f >/dev/null
"${COMPOSE[@]}" ps

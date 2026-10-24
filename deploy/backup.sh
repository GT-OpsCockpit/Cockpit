#!/usr/bin/env bash
# Nightly backup: the database (pg_dump) and the uploaded files (MinIO volume).
# Keeps the last 14 days in ~/backups. Run by cron (see README.md); on failure
# it writes to the log and, if BACKUP_ALERT_EMAIL is set, emails an alert.
set -uo pipefail

cd "$(dirname "$0")"
set -a; . ./.env; set +a

DEST="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS=14
STAMP="$(date +%F_%H%M)"
COMPOSE=(docker compose -f docker-compose.prod.yml)
mkdir -p "$DEST"

fail() {
  echo "$(date -Is) BACKUP FAILED: $1" | tee -a "$DEST/backup.log" >&2
  if [ -n "${BACKUP_ALERT_EMAIL:-}" ]; then
    "${COMPOSE[@]}" exec -T api node -e '
      const { createTransport } = require("nodemailer");
      createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined })
        .sendMail({ from: process.env.PARTNER_MAILER_FROM, to: process.env.BACKUP_ALERT_EMAIL,
          subject: "Cockpit: nightly backup FAILED", text: process.argv[1] })
        .catch((e) => { console.error(e); process.exit(1); });
    ' "$1" >/dev/null 2>&1 || true
  fi
  exit 1
}

# Database: written to a temp name first so a half-written dump is never kept.
"${COMPOSE[@]}" exec -T postgres pg_dump -U "${POSTGRES_USER:-cockpit}" "${POSTGRES_DB:-cockpit}" \
  | gzip > "$DEST/db-$STAMP.sql.gz.tmp" || fail "pg_dump failed"
# An empty/tiny dump means something went wrong even if the exit code was 0.
[ "$(stat -c %s "$DEST/db-$STAMP.sql.gz.tmp")" -gt 1000 ] || fail "database dump is empty"
mv "$DEST/db-$STAMP.sql.gz.tmp" "$DEST/db-$STAMP.sql.gz"

# Uploaded files (nameboards...): the MinIO data volume.
docker run --rm -v cockpit_minio_data:/data:ro -v "$DEST":/out alpine \
  tar czf "/out/files-$STAMP.tar.gz" -C /data . || fail "files archive failed"

find "$DEST" -maxdepth 1 -type f \( -name 'db-*' -o -name 'files-*' \) -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: db-$STAMP.sql.gz, files-$STAMP.tar.gz" >> "$DEST/backup.log"

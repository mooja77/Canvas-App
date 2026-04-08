#!/bin/bash
# QualCanvas PostgreSQL database backup
# Usage: DATABASE_URL="postgresql://..." ./scripts/backup.sh [backup-dir]
#
# Creates a timestamped pg_dump backup, compressed with gzip.
# Keeps the 10 most recent backups.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${1:-${BACKEND_DIR}/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/qualcanvas_${TIMESTAMP}.sql.gz"
MAX_BACKUPS=10

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL environment variable is required" >&2
  echo "Usage: DATABASE_URL=\"postgresql://user:pass@host:port/db\" $0" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Starting PostgreSQL backup..."
pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "Backup created: ${BACKUP_FILE} (${SIZE})"
else
  echo "Error: Backup failed" >&2
  exit 1
fi

# Prune old backups, keeping only the most recent MAX_BACKUPS
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/qualcanvas_*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
  PRUNE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
  ls -1t "${BACKUP_DIR}"/qualcanvas_*.sql.gz | tail -n "$PRUNE_COUNT" | xargs rm -f
  echo "Pruned ${PRUNE_COUNT} old backup(s), keeping ${MAX_BACKUPS} most recent"
fi

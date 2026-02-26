#!/bin/bash
# SQLite database backup script
# Usage: ./scripts/backup.sh [backup-dir]
#
# Creates a timestamped backup of the SQLite database using the
# .backup command for a safe, consistent copy (even while the DB is in use).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
DB_PATH="${BACKEND_DIR}/prisma/canvas-app.db"
BACKUP_DIR="${1:-${BACKEND_DIR}/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/canvas-app_${TIMESTAMP}.db"
MAX_BACKUPS=10

if [ ! -f "$DB_PATH" ]; then
  echo "Error: Database not found at ${DB_PATH}" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# Use SQLite's .backup command for a safe online backup
sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"

if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "Backup created: ${BACKUP_FILE} (${SIZE})"
else
  echo "Error: Backup failed" >&2
  exit 1
fi

# Prune old backups, keeping only the most recent MAX_BACKUPS
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/canvas-app_*.db 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
  PRUNE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
  ls -1t "${BACKUP_DIR}"/canvas-app_*.db | tail -n "$PRUNE_COUNT" | xargs rm -f
  echo "Pruned ${PRUNE_COUNT} old backup(s), keeping ${MAX_BACKUPS} most recent"
fi

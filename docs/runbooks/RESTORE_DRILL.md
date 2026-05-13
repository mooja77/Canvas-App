# Postgres restore drill — monthly runbook

Reliability fix #4 is only half done if we never verify the backups can be
restored. The backup workflow (`.github/workflows/backup-prod.yml`) dumps
prod weekly to R2 — this runbook is the monthly exercise that confirms the
dumps are restorable into a working DB.

Recommended cadence: **first Monday of every month**. Block 30 min on a
calendar; this is dull but mandatory.

## What you need

- Local Postgres 16 (`brew install postgresql@16` or Docker:
  `docker run --rm -p 55432:5432 -e POSTGRES_PASSWORD=test postgres:16`)
- `aws` CLI installed (`brew install awscli` or equivalent)
- R2 credentials with read on `qualcanvas-backups` (the GHA secrets work fine
  if you copy them locally; otherwise generate a read-only token for yourself
  in Cloudflare → R2 → Manage R2 API tokens)
- The Cloudflare account ID: `fe8383fe03ab5000c8fc4b13e4e2f0a8`

## Steps

```bash
# 1. Find the latest backup
export CLOUDFLARE_ACCOUNT_ID=fe8383fe03ab5000c8fc4b13e4e2f0a8
export AWS_ACCESS_KEY_ID=<R2 access key>
export AWS_SECRET_ACCESS_KEY=<R2 secret>
export AWS_DEFAULT_REGION=auto

aws s3 ls "s3://qualcanvas-backups/prod/" \
  --endpoint-url "https://$CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com" \
  | tail -5
# Note the most recent backup file name, e.g. qualcanvas-20260501T030017Z-12345.dump

# 2. Download it
aws s3 cp "s3://qualcanvas-backups/prod/qualcanvas-LATEST.dump" /tmp/latest.dump \
  --endpoint-url "https://$CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com"

# 3. Spin up an isolated Postgres
docker run --rm -d --name pg-restore-drill -p 55433:5432 \
  -e POSTGRES_PASSWORD=drill postgres:16
sleep 5

# 4. Create the target DB
PGPASSWORD=drill createdb -h localhost -p 55433 -U postgres qualcanvas_restored

# 5. Restore
PGPASSWORD=drill pg_restore -h localhost -p 55433 -U postgres \
  -d qualcanvas_restored --no-owner --no-privileges \
  /tmp/latest.dump
# Expect a few "ALTER OWNER" warnings — that's fine, --no-owner discards
# the prod role grants. Real errors look like "syntax error" or "permission
# denied" — fail the drill if any appear.

# 6. Spot-check a known row exists
PGPASSWORD=drill psql -h localhost -p 55433 -U postgres -d qualcanvas_restored -c \
  'SELECT COUNT(*) AS canvases, MAX("createdAt") AS most_recent FROM "CodingCanvas" WHERE "deletedAt" IS NULL;'
# Expect: canvases > 0, most_recent within the last week

# 7. Spot-check the demo dashboard access still exists
PGPASSWORD=drill psql -h localhost -p 55433 -U postgres -d qualcanvas_restored -c \
  'SELECT name, role FROM "DashboardAccess" WHERE name = '\''Demo Researcher'\'';'
# Expect: one row, role 'researcher'

# 8. Teardown
docker stop pg-restore-drill
rm /tmp/latest.dump
```

## Pass criteria

- pg_restore exits 0 (warnings allowed, errors fail)
- `COUNT(*) FROM CodingCanvas` returns a sane count (compare to a value from
  `/admin/dashboard` taken before the drill)
- `most_recent` createdAt is within the last 7 days (else backup is stale)
- Demo dashboard access row exists

## What to do if it fails

| Failure mode                              | First action                                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pg_restore: error: could not connect`    | Postgres container didn't start; check port collision on 55433                                                               |
| `permission denied` errors                | Restoring as wrong user; re-run with `--no-owner --no-privileges` (already in the command above — double-check)              |
| `relation "X" does not exist` mid-restore | Backup is partial/corrupt; download a prior backup and retry                                                                 |
| Spot-check returns 0 rows                 | Backup ran against an empty DB; verify GHA `backup-prod` workflow's secret `DATABASE_PUBLIC_URL` points to prod, not staging |

After investigating, file an issue with the specific error so the next drill
can validate the fix.

## Why monthly

Weekly is overkill (and would burn the team out on a tedious task).
Quarterly is too infrequent — by the time we find a broken backup, three
months of backups are useless. Monthly catches regressions within one weekly
backup cycle.

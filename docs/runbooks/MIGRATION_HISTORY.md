# Migration history — known divergence

## Summary

Migrations `0001_init` through `0011_user_ai_config` (plus `0016_add_report_schedule`) were originally authored when the Prisma datasource was set to SQLite. They use `DATETIME` instead of `TIMESTAMP(3)`, inline `PRIMARY KEY` instead of separate constraints, and inline `CONSTRAINT … FOREIGN KEY … REFERENCES` instead of separate `ALTER TABLE ADD CONSTRAINT` statements — all syntactically invalid on Postgres.

Prod runs on Postgres (Railway). The tables exist in their correct shape because prod was bootstrapped via `prisma db push` from `schema.prisma`, which generates valid Postgres DDL from the datamodel. The `_prisma_migrations` table was then populated retroactively via `prisma migrate resolve --applied <name>` for each migration to record them as applied (even though the SQL itself was never executed against Postgres).

## Why this matters

The CI **Schema Drift Check** job (`.github/workflows/ci.yml`) tries to apply the full migration history to a clean Postgres via `prisma migrate deploy`. It fails on migration 0006 with `ERROR: type "datetime" does not exist`. That check is therefore configured with `continue-on-error: true` — it surfaces as a failed job in the run summary but doesn't block the workflow.

What we lose by accepting this:

- Disaster recovery from R2 backup needs a manual workaround if it's restoring into a fresh Postgres rather than overwriting the existing prod DB (rare path).
- New Railway preview branches / local Postgres dev environments can't bootstrap via `migrate deploy`; they need `db push` instead.
- The drift-check job can't catch the "new model in `schema.prisma` without a migration" class of bug that the WebhookEvent incident (logged 3× this year) showed costs days each time.

## Why we haven't fixed it yet

Reconciling means:

1. Rewriting 11+ migration files (~700 lines of SQL) to Postgres syntax, in a way that produces the same final schema state.
2. Updating `_prisma_migrations.checksum` on prod for each rewritten migration, since Prisma stores the SHA-256 of the migration file and refuses to apply a deploy where checksums mismatch.
3. Running an end-to-end test against a fresh Postgres to confirm the rewrites compose to the current prod schema with zero drift.

That's ~6-8 hours of careful work, with real prod risk (a botched checksum update on prod means deploys break until manually corrected). Soft-failing the drift check is a cheap, reversible workaround that preserves the signal without taking on that risk during a high-velocity sprint.

## When to revisit

- **Trigger 1:** preparing for disaster-recovery drill that actually exercises restoring into a fresh Postgres.
- **Trigger 2:** a new model is added to `schema.prisma` without a migration and the bug ships to prod (the WebhookEvent class of incident). After that fire, the cost of fixing migration history becomes much lower than the cost of leaving it broken.
- **Trigger 3:** Railway preview branches become a desired workflow.

## The fix plan when we get there

1. Generate canonical Postgres SQL for each historical migration via `prisma migrate diff --from-empty --to-schema-datamodel <state-at-each-point>` (reconstruct the at-each-point state from git history).
2. Replace each `0001…0011` / `0016` migration file with the regenerated SQL.
3. Compute `sha256sum` of each new migration file. Store as the canonical checksum.
4. Open a short maintenance window. Connect to prod via `DATABASE_PUBLIC_URL`. For each migration: `UPDATE _prisma_migrations SET checksum = <new sha256> WHERE migration_name = <name>`.
5. Trigger a prod redeploy. `migrate deploy` should be a no-op (all marked applied, all checksums match).
6. In `.github/workflows/ci.yml`, remove `continue-on-error: true` from the `schema-drift` job.

## Related artifacts

- `.github/workflows/ci.yml` — the soft-failing drift check (`schema-drift` job).
- `apps/backend/prisma/migrations/0006_research_assistant/migration.sql` — exemplar SQLite-style migration (DATETIME, inline FK).
- `apps/backend/prisma/migrations/0012_add_reset_token_columns/migration.sql` — first Postgres-syntax migration; pattern to mimic when rewriting.
- `scripts/prod-recover-failed-migration.mjs` — separate recovery script for unrelated P3009 incident; useful pattern for the future prod-side checksum UPDATE step.

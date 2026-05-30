-- Reconcile residual column-type drift between schema.prisma and the prod DB
-- (prod was bootstrapped via `db push`, so Float columns landed as `real` and
-- a couple of AuditLog indexes were never created). All three retyped tables
-- are empty in prod (0 rows), so the type widenings carry no data; the
-- TrainingAttempt.passed Int->Boolean change uses an in-place cast (not the
-- drop/recreate Prisma's diff suggests) so it is data-preserving regardless.

-- DocumentRegionCoding: real -> double precision (Prisma Float)
ALTER TABLE "DocumentRegionCoding"
  ALTER COLUMN "x" SET DATA TYPE DOUBLE PRECISION,
  ALTER COLUMN "y" SET DATA TYPE DOUBLE PRECISION,
  ALTER COLUMN "width" SET DATA TYPE DOUBLE PRECISION,
  ALTER COLUMN "height" SET DATA TYPE DOUBLE PRECISION;

-- TrainingAttempt: kappaScore real -> double precision; passed integer -> boolean
ALTER TABLE "TrainingAttempt"
  ALTER COLUMN "kappaScore" SET DATA TYPE DOUBLE PRECISION;
ALTER TABLE "TrainingAttempt"
  ALTER COLUMN "passed" DROP DEFAULT;
ALTER TABLE "TrainingAttempt"
  ALTER COLUMN "passed" SET DATA TYPE BOOLEAN USING ("passed" <> 0);
ALTER TABLE "TrainingAttempt"
  ALTER COLUMN "passed" SET DEFAULT false;

-- TrainingDocument: passThreshold real -> double precision
ALTER TABLE "TrainingDocument"
  ALTER COLUMN "passThreshold" SET DATA TYPE DOUBLE PRECISION;

-- AuditLog: the two indexes the schema declares but db-push never created.
CREATE INDEX IF NOT EXISTS "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");

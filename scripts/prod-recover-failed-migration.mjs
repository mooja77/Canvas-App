#!/usr/bin/env node
/**
 * One-shot recovery for prod's P3009 state.
 *
 * Context: migration `0019_fix_critical_cascades` failed on prod because the
 * `Team` and `TeamMember` tables don't exist there (they were added to
 * schema.prisma without a creating migration — likely a missed `db push`
 * artifact predating the current migration history). 0019 tried to ALTER
 * the missing `Team` table and errored, leaving _prisma_migrations in a
 * failed state that blocks ALL subsequent migrations (0020, 0021, 0022)
 * from applying — and therefore blocks every deploy after the initial
 * Sprint A push.
 *
 * Recovery steps performed:
 *   1. CREATE TABLE IF NOT EXISTS Team / TeamMember with their indices.
 *      No FKs yet — those are added by 0019 itself.
 *   2. UPDATE _prisma_migrations SET rolled_back_at = NOW() on the failed
 *      0019 row so Prisma will retry it.
 *   3. `prisma migrate deploy` runs 0019 cleanly, then 0020/0021/0022.
 *
 * Pre-flight check (caller-verified):
 *   - TrainingAttempt has 0 rows on prod (so 0019's new FK on userId
 *     won't fail with orphan rows).
 *   - Team / TeamMember missing in prod.
 *
 * Usage:
 *   DATABASE_URL=<paste DATABASE_PUBLIC_URL from Railway> \
 *   node scripts/prod-recover-failed-migration.mjs
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const backendDir = path.join(repoRoot, 'apps', 'backend');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is not set.');
  process.exit(1);
}
if (databaseUrl.includes('localhost') || databaseUrl.startsWith('file:')) {
  console.error('ERROR: DATABASE_URL looks local — this script is prod-only.');
  process.exit(1);
}

const rl = readline.createInterface({ input, output });
const u = new URL(databaseUrl);
const confirm = (await rl.question(
  `About to recover failed migration 0019 against:\n  ${u.hostname}:${u.port} / db "${u.pathname.slice(1)}"\nProceed? (y/N) `,
)).trim().toLowerCase();
rl.close();
if (confirm !== 'y' && confirm !== 'yes') {
  console.log('Aborted.');
  process.exit(0);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

try {
  // Step 1: Pre-flight verification.
  const teamExists = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public."Team"')::text AS t, to_regclass('public."TeamMember"')::text AS tm`,
  );
  console.log(`\n[pre-flight] Team exists: ${teamExists[0].t}, TeamMember exists: ${teamExists[0].tm}`);

  const taCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "TrainingAttempt"`);
  console.log(`[pre-flight] TrainingAttempt row count: ${taCount[0].n}`);

  const failed = await prisma.$queryRawUnsafe(
    `SELECT migration_name, started_at, finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = '0019_fix_critical_cascades' AND rolled_back_at IS NULL AND finished_at IS NULL`,
  );
  if (failed.length === 0) {
    console.log('[pre-flight] No failed 0019 row found. Nothing to recover.');
    await prisma.$disconnect();
    process.exit(0);
  }

  // Step 2: Create Team + TeamMember tables idempotently. No FKs here —
  // migration 0019 will add the FKs cleanly once Team exists.
  console.log('\n[step 1/3] Creating Team and TeamMember tables …');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Team" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Team_ownerId_idx" ON "Team"("ownerId")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TeamMember" (
      "id" TEXT NOT NULL,
      "teamId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'member',
      "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId")`,
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TeamMember_teamId_idx" ON "TeamMember"("teamId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx" ON "TeamMember"("userId")`);

  // TeamMember FKs aren't in 0019 (only Team.ownerId, ReportSchedule.teamId,
  // TrainingAttempt.userId are). Add them here so Prisma's drift detector
  // sees a complete schema for these tables.
  await prisma.$executeRawUnsafe(`ALTER TABLE "TeamMember" DROP CONSTRAINT IF EXISTS "TeamMember_teamId_fkey"`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  );
  await prisma.$executeRawUnsafe(`ALTER TABLE "TeamMember" DROP CONSTRAINT IF EXISTS "TeamMember_userId_fkey"`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  );
  console.log('  Team + TeamMember in place.');

  // Step 3: Mark 0019 as rolled-back so `migrate deploy` will retry it.
  console.log('\n[step 2/3] Marking 0019 as rolled-back in _prisma_migrations …');
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "_prisma_migrations" SET "rolled_back_at" = NOW() WHERE "migration_name" = '0019_fix_critical_cascades' AND "rolled_back_at" IS NULL AND "finished_at" IS NULL`,
  );
  console.log(`  ${updated} row(s) marked.`);

  await prisma.$disconnect();

  // Step 4: Run migrate deploy + seed.
  console.log('\n[step 3/3] Running prisma migrate deploy …');
  execSync('npx prisma migrate deploy', {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  console.log('\n[bonus] Running canvas template seed …');
  execSync('npm run db:seed', {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  console.log('\nRecovery complete. Trigger a new Railway deploy (push any commit or click Redeploy).');
} catch (err) {
  console.error('\nRECOVERY FAILED:', err.message);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
}

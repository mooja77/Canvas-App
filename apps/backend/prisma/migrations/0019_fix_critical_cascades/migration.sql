-- Add missing CASCADE / FK constraints
-- 1. Team.ownerId: add onDelete CASCADE to prevent orphan teams on user deletion
-- 2. ReportSchedule.teamId: add FK + CASCADE to prevent orphan schedules on team deletion
-- 3. TrainingAttempt.userId: add FK + CASCADE so user deletion cleans up attempts

-- Team and TeamMember were originally introduced through `prisma db push`
-- and therefore had no earlier migration. Define them here before the
-- constraints below so a clean migration replay is valid. IF NOT EXISTS keeps
-- this safe for databases that were bootstrapped from the schema.
CREATE TABLE IF NOT EXISTS "Team" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamMember" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Team_ownerId_idx" ON "Team"("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");
CREATE INDEX IF NOT EXISTS "TeamMember_teamId_idx" ON "TeamMember"("teamId");
CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx" ON "TeamMember"("userId");

-- --- Team.ownerId: replace existing FK (no onDelete) with CASCADE ---
ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_ownerId_fkey";
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --- ReportSchedule.teamId: add FK that was missing entirely ---
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ReportSchedule_teamId_idx" ON "ReportSchedule"("teamId");

-- --- TrainingAttempt.userId: add FK that was missing entirely ---
ALTER TABLE "TrainingAttempt" ADD CONSTRAINT "TrainingAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "TrainingAttempt_userId_idx" ON "TrainingAttempt"("userId");

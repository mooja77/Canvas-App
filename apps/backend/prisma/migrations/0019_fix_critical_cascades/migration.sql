-- Add missing CASCADE / FK constraints
-- 1. Team.ownerId: add onDelete CASCADE to prevent orphan teams on user deletion
-- 2. ReportSchedule.teamId: add FK + CASCADE to prevent orphan schedules on team deletion
-- 3. TrainingAttempt.userId: add FK + CASCADE so user deletion cleans up attempts

-- --- Team.ownerId: replace existing FK (no onDelete) with CASCADE ---
ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_ownerId_fkey";
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --- ReportSchedule.teamId: add FK that was missing entirely ---
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ReportSchedule_teamId_idx" ON "ReportSchedule"("teamId");

-- --- TrainingAttempt.userId: add FK that was missing entirely ---
ALTER TABLE "TrainingAttempt" ADD CONSTRAINT "TrainingAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "TrainingAttempt_userId_idx" ON "TrainingAttempt"("userId");

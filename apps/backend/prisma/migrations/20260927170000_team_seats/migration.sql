-- Team seat billing: mirror of the Stripe subscription item quantity, the
-- one-off grace period for owners with more coders than seats, and the pool
-- owner for transcription minutes.
ALTER TABLE "Subscription" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN "seatGraceEndsAt" TIMESTAMP(3);
ALTER TABLE "AiUsage" ADD COLUMN "poolOwnerId" TEXT;

-- Existing transcription usage was metered per requester; attribute it to
-- the canvas owner so the pool starts from what was really used this month.
UPDATE "AiUsage" u
SET "poolOwnerId" = COALESCE(c."userId", da."userId", u."userId")
FROM "CodingCanvas" c
LEFT JOIN "DashboardAccess" da ON da.id = c."dashboardAccessId"
WHERE u."feature" = 'transcribe' AND u."canvasId" = c.id;

CREATE INDEX "AiUsage_poolOwnerId_feature_createdAt_idx" ON "AiUsage"("poolOwnerId", "feature", "createdAt");

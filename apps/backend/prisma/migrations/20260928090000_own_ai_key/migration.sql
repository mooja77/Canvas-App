-- All AI runs on the customer's own provider key (28 Sep 2026). No included
-- transcription minutes; usage is reported against the key that paid.
ALTER TABLE "UserAiConfig" ADD COLUMN "shareWithCollaborators" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TranscriptionJob" ADD COLUMN "keyOwnerUserId" TEXT;
ALTER TABLE "AiUsage" ADD COLUMN "keyOwnerId" TEXT;
ALTER TABLE "AiUsage" ADD COLUMN "durationSeconds" INTEGER;

CREATE INDEX "AiUsage_keyOwnerId_feature_createdAt_idx" ON "AiUsage"("keyOwnerId", "feature", "createdAt");

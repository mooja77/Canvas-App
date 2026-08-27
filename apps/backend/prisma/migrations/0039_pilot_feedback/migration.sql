-- Store voluntary, structured real-user pilot feedback without linking it to
-- an account. Contact details are optional and require explicit consent.
CREATE TABLE "PilotFeedback" (
    "id" TEXT NOT NULL,
    "participantRole" TEXT NOT NULL,
    "sector" TEXT,
    "productExperience" TEXT NOT NULL,
    "taskResults" TEXT NOT NULL,
    "hardestStep" TEXT,
    "missingFeature" TEXT,
    "adoptionBlocker" TEXT,
    "recommendationScore" INTEGER NOT NULL,
    "contactEmail" TEXT,
    "consentToContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PilotFeedback_createdAt_idx" ON "PilotFeedback"("createdAt");
CREATE INDEX "PilotFeedback_participantRole_idx" ON "PilotFeedback"("participantRole");
CREATE INDEX "PilotFeedback_recommendationScore_idx" ON "PilotFeedback"("recommendationScore");

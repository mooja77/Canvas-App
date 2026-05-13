-- Sprint F onboarding v2: track per-user flow state + canvas templates that
-- users can instantiate to skip the empty-canvas cold start. New columns on
-- User are nullable so the migration is non-blocking; the table is large in
-- prod and we don't want to lock it. CanvasTemplate has FK SetNull to User
-- so deleting a user keeps their templates (likely useful — they may have
-- shared a custom template publicly before churning).

ALTER TABLE "User" ADD COLUMN "onboardingState" TEXT DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

CREATE TABLE "CanvasTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'methodology',
    "method" TEXT,
    "sampleQuestions" TEXT NOT NULL,
    "sampleTranscript" TEXT NOT NULL,
    "sampleMemos" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CanvasTemplate_name_createdBy_key" ON "CanvasTemplate"("name", "createdBy");
CREATE INDEX "CanvasTemplate_isPublic_category_idx" ON "CanvasTemplate"("isPublic", "category");

ALTER TABLE "CanvasTemplate" ADD CONSTRAINT "CanvasTemplate_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

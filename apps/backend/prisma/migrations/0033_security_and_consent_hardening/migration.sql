-- Separate verification from password-reset credentials.
ALTER TABLE "User" ADD COLUMN "verificationTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "verificationTokenExpiry" TIMESTAMP(3);

-- Durable transcription recovery metadata.
ALTER TABLE "TranscriptionJob" ADD COLUMN "language" TEXT;
ALTER TABLE "TranscriptionJob" ADD COLUMN "requestedByUserId" TEXT;

-- Distributed scheduler claim.
ALTER TABLE "ReportSchedule" ADD COLUMN "processingAt" TIMESTAMP(3);

-- New engagement preferences are opt-in by default.
ALTER TABLE "EmailPreference" ALTER COLUMN "lifecycle" SET DEFAULT false;
ALTER TABLE "EmailPreference" ALTER COLUMN "productUpdates" SET DEFAULT false;
ALTER TABLE "EmailPreference" ALTER COLUMN "trainingTips" SET DEFAULT false;
ALTER TABLE "EmailPreference" ALTER COLUMN "inactivityNudges" SET DEFAULT false;

CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmTokenHash" TEXT,
    "unsubscribeToken" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");
CREATE UNIQUE INDEX "NewsletterSubscriber_unsubscribeToken_key" ON "NewsletterSubscriber"("unsubscribeToken");
CREATE INDEX "NewsletterSubscriber_status_idx" ON "NewsletterSubscriber"("status");

-- Add bounded retry and provider outcome state without enabling lifecycle mail.
ALTER TABLE "EmailDelivery" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailDelivery" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "EmailDelivery" ADD COLUMN "retryAt" TIMESTAMP(3);
ALTER TABLE "EmailDelivery" ADD COLUMN "provider" TEXT;
ALTER TABLE "EmailDelivery" ADD COLUMN "providerMessageId" TEXT;
ALTER TABLE "EmailDelivery" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "EmailDelivery" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "EmailDelivery" ADD COLUMN "bouncedAt" TIMESTAMP(3);
ALTER TABLE "EmailDelivery" ADD COLUMN "complainedAt" TIMESTAMP(3);
ALTER TABLE "EmailDelivery" ADD COLUMN "suppressedAt" TIMESTAMP(3);
ALTER TABLE "EmailDelivery" ADD COLUMN "providerEventAt" TIMESTAMP(3);

ALTER TABLE "EmailPreference" ADD COLUMN "providerSuppressedAt" TIMESTAMP(3);
ALTER TABLE "EmailPreference" ADD COLUMN "providerSuppressionReason" TEXT;

ALTER TABLE "NewsletterSubscriber" ADD COLUMN "providerSuppressedAt" TIMESTAMP(3);
ALTER TABLE "NewsletterSubscriber" ADD COLUMN "providerSuppressionReason" TEXT;

ALTER TABLE "NewsletterDelivery" ADD COLUMN "provider" TEXT;
ALTER TABLE "NewsletterDelivery" ADD COLUMN "providerMessageId" TEXT;
ALTER TABLE "NewsletterDelivery" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "NewsletterDelivery" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "NewsletterDelivery" ADD COLUMN "bouncedAt" TIMESTAMP(3);
ALTER TABLE "NewsletterDelivery" ADD COLUMN "complainedAt" TIMESTAMP(3);
ALTER TABLE "NewsletterDelivery" ADD COLUMN "suppressedAt" TIMESTAMP(3);
ALTER TABLE "NewsletterDelivery" ADD COLUMN "providerEventAt" TIMESTAMP(3);

-- Historical "sent" means provider acceptance. Preserve that evidence while
-- ensuring the UI cannot mistake it for provider-confirmed delivery.
UPDATE "EmailDelivery"
SET "status" = 'accepted', "attemptCount" = 1, "acceptedAt" = "sentAt"
WHERE "status" = 'sent';

UPDATE "EmailDelivery"
SET "status" = 'failed_retryable', "attemptCount" = 1
WHERE "status" = 'failed';

-- Newsletter history used the same ambiguous "sent" label. Treat it as
-- provider acceptance and wait for signed provider events before calling a
-- message delivered.
UPDATE "NewsletterDelivery"
SET "status" = 'accepted', "acceptedAt" = "sentAt"
WHERE "status" = 'sent';

UPDATE "NewsletterDelivery"
SET "status" = 'failed_permanent'
WHERE "status" = 'failed';

CREATE INDEX "EmailDelivery_status_retryAt_attemptCount_idx"
ON "EmailDelivery"("status", "retryAt", "attemptCount");

CREATE INDEX "EmailDelivery_provider_providerMessageId_idx"
ON "EmailDelivery"("provider", "providerMessageId");

CREATE INDEX "NewsletterDelivery_provider_providerMessageId_idx"
ON "NewsletterDelivery"("provider", "providerMessageId");

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

-- Historical "sent" means provider acceptance. Preserve that evidence while
-- ensuring the UI cannot mistake it for provider-confirmed delivery.
UPDATE "EmailDelivery"
SET "status" = 'accepted', "attemptCount" = 1, "acceptedAt" = "sentAt"
WHERE "status" = 'sent';

UPDATE "EmailDelivery"
SET "status" = 'failed_retryable', "attemptCount" = 1
WHERE "status" = 'failed';

CREATE INDEX "EmailDelivery_status_retryAt_attemptCount_idx"
ON "EmailDelivery"("status", "retryAt", "attemptCount");

CREATE INDEX "EmailDelivery_provider_providerMessageId_idx"
ON "EmailDelivery"("provider", "providerMessageId");

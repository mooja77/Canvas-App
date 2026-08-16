CREATE TABLE "NewsletterDelivery" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "NewsletterDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsletterDelivery_subscriberId_campaignId_key"
ON "NewsletterDelivery"("subscriberId", "campaignId");

CREATE INDEX "NewsletterDelivery_campaignId_status_idx"
ON "NewsletterDelivery"("campaignId", "status");

ALTER TABLE "NewsletterDelivery"
ADD CONSTRAINT "NewsletterDelivery_subscriberId_fkey"
FOREIGN KEY ("subscriberId") REFERENCES "NewsletterSubscriber"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NewsletterDelivery"
ADD CONSTRAINT "NewsletterDelivery_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

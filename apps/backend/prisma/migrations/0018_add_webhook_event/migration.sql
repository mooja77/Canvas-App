-- Stripe webhook idempotency table. The Prisma `WebhookEvent` model was added
-- to schema.prisma in March 2026 (commit 82f68e15) but the matching migration
-- was never generated. Production Postgres has been missing the table ever
-- since; every Stripe webhook delivery to /api/billing/webhook crashes the
-- backend (P2021 from prisma.webhookEvent.findUnique → uncaught → exit), and
-- after restartPolicyMaxRetries=3 Railway marks the deployment CRASHED. This
-- migration creates the table so `prisma migrate deploy` (run by the start
-- script before `node dist/index.js`) brings it into existence on the next
-- deploy.

CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Reliability fix #8 — durable AI job record so tab-close mid-Auto-Code
-- doesn't lose work or double-bill. Idempotency-key indexed unique so the
-- client can safely retry a request and get the cached result.

CREATE TABLE "AiJob" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT,
    "canvasId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "error" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costCents" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiJob_idempotencyKey_key" ON "AiJob"("idempotencyKey");
CREATE INDEX "AiJob_userId_createdAt_idx" ON "AiJob"("userId", "createdAt");
CREATE INDEX "AiJob_canvasId_type_idx" ON "AiJob"("canvasId", "type");
CREATE INDEX "AiJob_status_createdAt_idx" ON "AiJob"("status", "createdAt");

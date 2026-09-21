ALTER TABLE "User"
  ADD COLUMN "firstValueAt" TIMESTAMP(3),
  ADD COLUMN "firstValueCanvasId" TEXT,
  ADD COLUMN "firstValueEvidence" TEXT,
  ADD COLUMN "lifecycleCohortStartedAt" TIMESTAMP(3);

-- The previous timestamp meant "closed the two-screen setup", including a
-- skip or a blank/sample canvas. Clear that ambiguous signal before replacing
-- it with evidence of an actually saved research coding below.
UPDATE "User" SET "onboardingCompletedAt" = NULL;

-- Preserve genuine first value already earned before this durable marker was
-- introduced. Sample-template codings do not qualify, and no research text is
-- copied into the account record.
WITH ranked_first_value AS (
  SELECT
    COALESCE(c."coderUserId", canvas."userId") AS "userId",
    c."createdAt" AS "firstValueAt",
    c."canvasId",
    c.id AS "codingId",
    c."transcriptId",
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(c."coderUserId", canvas."userId")
      ORDER BY c."createdAt" ASC, c.id ASC
    ) AS position
  FROM "CanvasTextCoding" c
  JOIN "CodingCanvas" canvas ON canvas.id = c."canvasId"
  JOIN "CanvasTranscript" transcript ON transcript.id = c."transcriptId"
  WHERE COALESCE(c.source, 'human') <> 'sample'
    AND transcript."sourceType" IS DISTINCT FROM 'sample'
    AND COALESCE(c."coderUserId", canvas."userId") IS NOT NULL
)
UPDATE "User" u
SET
  "firstValueAt" = first_value."firstValueAt",
  "firstValueCanvasId" = first_value."canvasId",
  "onboardingCompletedAt" = first_value."firstValueAt",
  "firstValueEvidence" = json_build_object(
    'kind', 'first_real_coding',
    'canvasId', first_value."canvasId",
    'codingId', first_value."codingId",
    'transcriptId', first_value."transcriptId",
    'recordedAt', first_value."firstValueAt"
  )::text
FROM ranked_first_value first_value
WHERE first_value.position = 1
  AND u.id = first_value."userId"
  AND u."firstValueAt" IS NULL;

CREATE INDEX "User_firstValueAt_idx" ON "User"("firstValueAt");
CREATE INDEX "User_lifecycleCohortStartedAt_idx" ON "User"("lifecycleCohortStartedAt");

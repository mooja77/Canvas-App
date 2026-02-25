-- Ethics compliance migration for D1 cloud database
-- This handles the case where ConsentRecord doesn't exist yet

-- Step 1: Recreate CanvasTranscript with new columns
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_CanvasTranscript" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canvasId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "caseId" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "deletedAt" DATETIME,
    "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
    "participantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CanvasTranscript_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CanvasTranscript_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CanvasCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CanvasTranscript" ("canvasId", "caseId", "content", "createdAt", "id", "sortOrder", "sourceId", "sourceType", "title", "updatedAt") SELECT "canvasId", "caseId", "content", "createdAt", "id", "sortOrder", "sourceId", "sourceType", "title", "updatedAt" FROM "CanvasTranscript";
DROP TABLE "CanvasTranscript";
ALTER TABLE "new_CanvasTranscript" RENAME TO "CanvasTranscript";

-- Step 2: Recreate CodingCanvas with ethics fields
CREATE TABLE "new_CodingCanvas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dashboardAccessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ethicsApprovalId" TEXT,
    "ethicsStatus" TEXT NOT NULL DEFAULT 'pending',
    "dataRetentionDate" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CodingCanvas_dashboardAccessId_fkey" FOREIGN KEY ("dashboardAccessId") REFERENCES "DashboardAccess" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CodingCanvas" ("createdAt", "dashboardAccessId", "description", "id", "name", "updatedAt") SELECT "createdAt", "dashboardAccessId", "description", "id", "name", "updatedAt" FROM "CodingCanvas";
DROP TABLE "CodingCanvas";
ALTER TABLE "new_CodingCanvas" RENAME TO "CodingCanvas";

-- Step 3: Create ConsentRecord table fresh
CREATE TABLE IF NOT EXISTS "ConsentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canvasId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL DEFAULT 'informed',
    "consentStatus" TEXT NOT NULL DEFAULT 'active',
    "consentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawalDate" DATETIME,
    "ethicsProtocol" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsentRecord_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Step 4: Drop old indexes that will conflict (from init migration)
DROP INDEX IF EXISTS "idx_coding_canvas";
DROP INDEX IF EXISTS "idx_coding_transcript";
DROP INDEX IF EXISTS "idx_coding_question";
DROP INDEX IF EXISTS "idx_coding_canvas_transcript";
DROP INDEX IF EXISTS "idx_audit_action";

-- Step 5: Create all indexes with Prisma-standard names
CREATE INDEX IF NOT EXISTS "CanvasTranscript_canvasId_idx" ON "CanvasTranscript"("canvasId");
CREATE INDEX IF NOT EXISTS "CanvasTranscript_caseId_idx" ON "CanvasTranscript"("caseId");
CREATE INDEX IF NOT EXISTS "CanvasTranscript_deletedAt_idx" ON "CanvasTranscript"("deletedAt");
CREATE INDEX IF NOT EXISTS "CodingCanvas_dashboardAccessId_idx" ON "CodingCanvas"("dashboardAccessId");
CREATE INDEX IF NOT EXISTS "CodingCanvas_deletedAt_idx" ON "CodingCanvas"("deletedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CodingCanvas_dashboardAccessId_name_key" ON "CodingCanvas"("dashboardAccessId", "name");
CREATE INDEX IF NOT EXISTS "ConsentRecord_canvasId_idx" ON "ConsentRecord"("canvasId");
CREATE INDEX IF NOT EXISTS "ConsentRecord_participantId_idx" ON "ConsentRecord"("participantId");
CREATE UNIQUE INDEX IF NOT EXISTS "ConsentRecord_canvasId_participantId_key" ON "ConsentRecord"("canvasId", "participantId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "CanvasCase_canvasId_idx" ON "CanvasCase"("canvasId");
CREATE INDEX IF NOT EXISTS "CanvasComputedNode_canvasId_idx" ON "CanvasComputedNode"("canvasId");
CREATE INDEX IF NOT EXISTS "CanvasNodePosition_canvasId_idx" ON "CanvasNodePosition"("canvasId");
CREATE INDEX IF NOT EXISTS "CanvasQuestion_canvasId_idx" ON "CanvasQuestion"("canvasId");
CREATE INDEX IF NOT EXISTS "CanvasQuestion_parentQuestionId_idx" ON "CanvasQuestion"("parentQuestionId");
CREATE INDEX IF NOT EXISTS "CanvasRelation_canvasId_idx" ON "CanvasRelation"("canvasId");
CREATE INDEX IF NOT EXISTS "CanvasShare_canvasId_idx" ON "CanvasShare"("canvasId");
CREATE INDEX IF NOT EXISTS "CanvasShare_shareCode_idx" ON "CanvasShare"("shareCode");
CREATE INDEX IF NOT EXISTS "CanvasTextCoding_canvasId_idx" ON "CanvasTextCoding"("canvasId");
CREATE INDEX IF NOT EXISTS "CanvasTextCoding_transcriptId_idx" ON "CanvasTextCoding"("transcriptId");
CREATE INDEX IF NOT EXISTS "CanvasTextCoding_questionId_idx" ON "CanvasTextCoding"("questionId");
CREATE INDEX IF NOT EXISTS "CanvasTextCoding_canvasId_transcriptId_idx" ON "CanvasTextCoding"("canvasId", "transcriptId");

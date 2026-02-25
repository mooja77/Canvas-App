/*
  Warnings:

  - You are about to drop the column `action` on the `ConsentRecord` table. All the data in the column will be lost.
  - You are about to drop the column `consentVersion` on the `ConsentRecord` table. All the data in the column will be lost.
  - You are about to drop the column `ipHash` on the `ConsentRecord` table. All the data in the column will be lost.
  - You are about to drop the column `subjectId` on the `ConsentRecord` table. All the data in the column will be lost.
  - You are about to drop the column `subjectType` on the `ConsentRecord` table. All the data in the column will be lost.
  - Added the required column `canvasId` to the `ConsentRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `participantId` to the `ConsentRecord` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
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
CREATE INDEX "CanvasTranscript_canvasId_idx" ON "CanvasTranscript"("canvasId");
CREATE INDEX "CanvasTranscript_caseId_idx" ON "CanvasTranscript"("caseId");
CREATE INDEX "CanvasTranscript_deletedAt_idx" ON "CanvasTranscript"("deletedAt");
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
CREATE INDEX "CodingCanvas_dashboardAccessId_idx" ON "CodingCanvas"("dashboardAccessId");
CREATE INDEX "CodingCanvas_deletedAt_idx" ON "CodingCanvas"("deletedAt");
CREATE UNIQUE INDEX "CodingCanvas_dashboardAccessId_name_key" ON "CodingCanvas"("dashboardAccessId", "name");
CREATE TABLE "new_ConsentRecord" (
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
INSERT INTO "new_ConsentRecord" ("createdAt", "id") SELECT "createdAt", "id" FROM "ConsentRecord";
DROP TABLE "ConsentRecord";
ALTER TABLE "new_ConsentRecord" RENAME TO "ConsentRecord";
CREATE INDEX "ConsentRecord_canvasId_idx" ON "ConsentRecord"("canvasId");
CREATE INDEX "ConsentRecord_participantId_idx" ON "ConsentRecord"("participantId");
CREATE UNIQUE INDEX "ConsentRecord_canvasId_participantId_key" ON "ConsentRecord"("canvasId", "participantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "CanvasCase_canvasId_idx" ON "CanvasCase"("canvasId");

-- CreateIndex
CREATE INDEX "CanvasComputedNode_canvasId_idx" ON "CanvasComputedNode"("canvasId");

-- CreateIndex
CREATE INDEX "CanvasNodePosition_canvasId_idx" ON "CanvasNodePosition"("canvasId");

-- CreateIndex
CREATE INDEX "CanvasQuestion_canvasId_idx" ON "CanvasQuestion"("canvasId");

-- CreateIndex
CREATE INDEX "CanvasQuestion_parentQuestionId_idx" ON "CanvasQuestion"("parentQuestionId");

-- CreateIndex
CREATE INDEX "CanvasRelation_canvasId_idx" ON "CanvasRelation"("canvasId");

-- CreateIndex
CREATE INDEX "CanvasShare_canvasId_idx" ON "CanvasShare"("canvasId");

-- CreateIndex
CREATE INDEX "CanvasShare_shareCode_idx" ON "CanvasShare"("shareCode");

-- CreateIndex
CREATE INDEX "CanvasTextCoding_canvasId_idx" ON "CanvasTextCoding"("canvasId");

-- CreateIndex
CREATE INDEX "CanvasTextCoding_transcriptId_idx" ON "CanvasTextCoding"("transcriptId");

-- CreateIndex
CREATE INDEX "CanvasTextCoding_questionId_idx" ON "CanvasTextCoding"("questionId");

-- CreateIndex
CREATE INDEX "CanvasTextCoding_canvasId_transcriptId_idx" ON "CanvasTextCoding"("canvasId", "transcriptId");

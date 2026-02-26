-- CreateTable
CREATE TABLE "DashboardAccess" (
    "id" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "accessCodeHash" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodingCanvas" (
    "id" TEXT NOT NULL,
    "dashboardAccessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ethicsApprovalId" TEXT,
    "ethicsStatus" TEXT NOT NULL DEFAULT 'pending',
    "dataRetentionDate" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodingCanvas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasShare" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "shareCode" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "cloneCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanvasShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasTranscript" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "caseId" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
    "participantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasQuestion" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parentQuestionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasMemo" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#FEF08A',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasMemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasTextCoding" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "codedText" TEXT NOT NULL,
    "note" TEXT,
    "annotation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanvasTextCoding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasNodePosition" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "collapsed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CanvasNodePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasCase" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributes" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasRelation" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanvasRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasComputedNode" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "result" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasComputedNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL DEFAULT 'informed',
    "consentStatus" TEXT NOT NULL DEFAULT 'active',
    "consentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawalDate" TIMESTAMP(3),
    "ethicsProtocol" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "ip" TEXT,
    "method" TEXT,
    "path" TEXT,
    "statusCode" INTEGER,
    "meta" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DashboardAccess_accessCode_key" ON "DashboardAccess"("accessCode");

-- CreateIndex
CREATE UNIQUE INDEX "CodingCanvas_dashboardAccessId_name_key" ON "CodingCanvas"("dashboardAccessId", "name");
CREATE INDEX "CodingCanvas_dashboardAccessId_idx" ON "CodingCanvas"("dashboardAccessId");
CREATE INDEX "CodingCanvas_deletedAt_idx" ON "CodingCanvas"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CanvasShare_shareCode_key" ON "CanvasShare"("shareCode");
CREATE INDEX "CanvasShare_canvasId_idx" ON "CanvasShare"("canvasId");
CREATE INDEX "CanvasShare_shareCode_idx" ON "CanvasShare"("shareCode");

-- CreateIndex
CREATE INDEX "CanvasTranscript_canvasId_idx" ON "CanvasTranscript"("canvasId");
CREATE INDEX "CanvasTranscript_caseId_idx" ON "CanvasTranscript"("caseId");
CREATE INDEX "CanvasTranscript_deletedAt_idx" ON "CanvasTranscript"("deletedAt");

-- CreateIndex
CREATE INDEX "CanvasQuestion_canvasId_idx" ON "CanvasQuestion"("canvasId");
CREATE INDEX "CanvasQuestion_parentQuestionId_idx" ON "CanvasQuestion"("parentQuestionId");

-- CreateIndex
CREATE INDEX "CanvasTextCoding_canvasId_idx" ON "CanvasTextCoding"("canvasId");
CREATE INDEX "CanvasTextCoding_transcriptId_idx" ON "CanvasTextCoding"("transcriptId");
CREATE INDEX "CanvasTextCoding_questionId_idx" ON "CanvasTextCoding"("questionId");
CREATE INDEX "CanvasTextCoding_canvasId_transcriptId_idx" ON "CanvasTextCoding"("canvasId", "transcriptId");

-- CreateIndex
CREATE UNIQUE INDEX "CanvasNodePosition_canvasId_nodeId_key" ON "CanvasNodePosition"("canvasId", "nodeId");
CREATE INDEX "CanvasNodePosition_canvasId_idx" ON "CanvasNodePosition"("canvasId");

-- CreateIndex
CREATE UNIQUE INDEX "CanvasCase_canvasId_name_key" ON "CanvasCase"("canvasId", "name");
CREATE INDEX "CanvasCase_canvasId_idx" ON "CanvasCase"("canvasId");

-- CreateIndex
CREATE INDEX "CanvasRelation_canvasId_idx" ON "CanvasRelation"("canvasId");

-- CreateIndex
CREATE INDEX "CanvasComputedNode_canvasId_idx" ON "CanvasComputedNode"("canvasId");

-- CreateIndex
CREATE INDEX "ConsentRecord_canvasId_idx" ON "ConsentRecord"("canvasId");
CREATE INDEX "ConsentRecord_participantId_idx" ON "ConsentRecord"("participantId");
CREATE UNIQUE INDEX "ConsentRecord_canvasId_participantId_key" ON "ConsentRecord"("canvasId", "participantId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "CodingCanvas" ADD CONSTRAINT "CodingCanvas_dashboardAccessId_fkey" FOREIGN KEY ("dashboardAccessId") REFERENCES "DashboardAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasShare" ADD CONSTRAINT "CanvasShare_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasTranscript" ADD CONSTRAINT "CanvasTranscript_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CanvasTranscript" ADD CONSTRAINT "CanvasTranscript_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CanvasCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasQuestion" ADD CONSTRAINT "CanvasQuestion_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CanvasQuestion" ADD CONSTRAINT "CanvasQuestion_parentQuestionId_fkey" FOREIGN KEY ("parentQuestionId") REFERENCES "CanvasQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasMemo" ADD CONSTRAINT "CanvasMemo_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasTextCoding" ADD CONSTRAINT "CanvasTextCoding_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CanvasTextCoding" ADD CONSTRAINT "CanvasTextCoding_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "CanvasTranscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CanvasTextCoding" ADD CONSTRAINT "CanvasTextCoding_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CanvasQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasNodePosition" ADD CONSTRAINT "CanvasNodePosition_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasCase" ADD CONSTRAINT "CanvasCase_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasRelation" ADD CONSTRAINT "CanvasRelation_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasComputedNode" ADD CONSTRAINT "CanvasComputedNode_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add fileUploadId and timestamps to CanvasTranscript
ALTER TABLE "CanvasTranscript" ADD COLUMN "fileUploadId" TEXT;
ALTER TABLE "CanvasTranscript" ADD COLUMN "timestamps" TEXT;

-- CreateTable
CREATE TABLE "FileUpload" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT,
    "userId" TEXT,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptionJob" (
    "id" TEXT NOT NULL,
    "fileUploadId" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resultText" TEXT,
    "resultSegments" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileUpload_storageKey_key" ON "FileUpload"("storageKey");

-- CreateIndex
CREATE INDEX "FileUpload_canvasId_idx" ON "FileUpload"("canvasId");

-- CreateIndex
CREATE INDEX "FileUpload_storageKey_idx" ON "FileUpload"("storageKey");

-- CreateIndex
CREATE INDEX "TranscriptionJob_canvasId_idx" ON "TranscriptionJob"("canvasId");

-- CreateIndex
CREATE INDEX "TranscriptionJob_status_idx" ON "TranscriptionJob"("status");

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptionJob" ADD CONSTRAINT "TranscriptionJob_fileUploadId_fkey" FOREIGN KEY ("fileUploadId") REFERENCES "FileUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

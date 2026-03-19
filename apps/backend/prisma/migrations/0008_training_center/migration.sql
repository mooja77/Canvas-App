-- CreateTable
CREATE TABLE "TrainingDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canvasId" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "goldCodings" TEXT NOT NULL,
    "passThreshold" REAL NOT NULL DEFAULT 0.7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingDocument_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingDocumentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codings" TEXT NOT NULL,
    "kappaScore" REAL,
    "passed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingAttempt_trainingDocumentId_fkey" FOREIGN KEY ("trainingDocumentId") REFERENCES "TrainingDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TrainingDocument_canvasId_idx" ON "TrainingDocument"("canvasId");

-- CreateIndex
CREATE INDEX "TrainingAttempt_trainingDocumentId_idx" ON "TrainingAttempt"("trainingDocumentId");

-- CreateTable
CREATE TABLE "CanvasCollaborator" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanvasCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanvasCollaborator_canvasId_idx" ON "CanvasCollaborator"("canvasId");

-- CreateIndex
CREATE INDEX "CanvasCollaborator_userId_idx" ON "CanvasCollaborator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CanvasCollaborator_canvasId_userId_key" ON "CanvasCollaborator"("canvasId", "userId");

-- AddForeignKey
ALTER TABLE "CanvasCollaborator" ADD CONSTRAINT "CanvasCollaborator_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

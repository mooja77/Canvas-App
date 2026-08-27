-- Persist document-shaped visual research artefacts that previously existed
-- only in one browser's localStorage. Additive and cascade-safe.
CREATE TABLE "CanvasArtifact" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CanvasArtifact_canvasId_type_key" ON "CanvasArtifact"("canvasId", "type");
CREATE INDEX "CanvasArtifact_canvasId_idx" ON "CanvasArtifact"("canvasId");

ALTER TABLE "CanvasArtifact"
    ADD CONSTRAINT "CanvasArtifact_canvasId_fkey"
    FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

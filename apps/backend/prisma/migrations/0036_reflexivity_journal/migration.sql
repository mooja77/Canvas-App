-- Give the reflexivity journal a server home.
--
-- Entries lived only in the browser's localStorage under `canvas-journal-<id>`,
-- while the panel that writes them cites Lincoln & Guba and promises "an audit
-- trail for your analytical choices". They were invisible on a second device,
-- absent from every export, and lost with site data.
--
-- Additive only: creates one new table. Nothing existing is altered or dropped,
-- so this cannot fail against current production data.
CREATE TABLE "CanvasJournalEntry" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "coderUserId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasJournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CanvasJournalEntry_canvasId_idx" ON "CanvasJournalEntry"("canvasId");

ALTER TABLE "CanvasJournalEntry"
    ADD CONSTRAINT "CanvasJournalEntry_canvasId_fkey"
    FOREIGN KEY ("canvasId") REFERENCES "CodingCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

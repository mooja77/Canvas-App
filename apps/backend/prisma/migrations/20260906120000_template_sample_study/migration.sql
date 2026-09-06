-- Starter templates gain further transcripts and seeded coded excerpts so a new
-- researcher sees a coded small study before bringing data of their own.
ALTER TABLE "CanvasTemplate" ADD COLUMN "additionalTranscripts" TEXT;
ALTER TABLE "CanvasTemplate" ADD COLUMN "sampleCodings" TEXT;

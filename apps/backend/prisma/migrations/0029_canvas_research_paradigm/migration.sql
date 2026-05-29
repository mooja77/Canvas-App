-- Persist the qualitative paradigm a canvas's study follows (from the
-- Methodology wizard) so guidance can be tailored and the methods-statement /
-- AI-disclosure can reference it. Nullable + additive: no backfill.
ALTER TABLE "CodingCanvas" ADD COLUMN "researchParadigm" TEXT;

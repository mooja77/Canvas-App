-- Persist the model's rationale for each AI code suggestion so the review
-- panel can show *why* a code was proposed (human-in-the-loop trust). The
-- suggest-codes flow already produces this; it was being dropped before save.
-- Nullable + additive: no backfill, existing rows get NULL.
ALTER TABLE "AiSuggestion" ADD COLUMN "reasoning" TEXT;

-- Add remaining FK + index gaps identified during the 2026-05-15 schema audit
-- (Master plan §Horizon 0 — schema-state correction).
--
-- 1. AiSuggestion.questionId: nullable column with no FK and no index.
--    Add FK to CanvasQuestion with SET NULL on delete (matches column nullability)
--    and a supporting index for "suggestions for question X" lookups.
-- 2. FileUpload.userId: nullable column with no FK and no index.
--    Add FK to User with SET NULL on delete (preserves orphaned uploads through
--    user deletion rather than dropping the file metadata) and a supporting
--    index for "user's uploads" lookups.

-- --- AiSuggestion.questionId: add FK + index ---
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "CanvasQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AiSuggestion_questionId_idx" ON "AiSuggestion"("questionId");

-- --- FileUpload.userId: add FK + index ---
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "FileUpload_userId_idx" ON "FileUpload"("userId");

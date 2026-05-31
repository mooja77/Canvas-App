-- Add coder attribution to CanvasTextCoding so genuine multi-coder intercoder
-- reliability (Cohen's κ / Krippendorff's α) can attribute each coding to the
-- researcher who created it. Purely additive and data-preserving:
--   * coderUserId is NULLABLE — legacy codings (and AI/script-created codings)
--     keep NULL, so no backfill is required and the migration cannot fail on
--     existing rows.
--   * ON DELETE SET NULL — deleting a user nulls their attribution rather than
--     cascading away the coding data.

ALTER TABLE "CanvasTextCoding" ADD COLUMN IF NOT EXISTS "coderUserId" TEXT;

CREATE INDEX IF NOT EXISTS "CanvasTextCoding_coderUserId_idx" ON "CanvasTextCoding"("coderUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CanvasTextCoding_coderUserId_fkey'
  ) THEN
    ALTER TABLE "CanvasTextCoding"
      ADD CONSTRAINT "CanvasTextCoding_coderUserId_fkey"
      FOREIGN KEY ("coderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

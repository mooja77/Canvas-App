-- Adds provenance to codings so we can distinguish human-created codings from
-- those created by accepting an AI suggestion. Powers the IRB-ready AI
-- disclosure export ("X% of codings originated as AI suggestions").
--
-- Purely additive: NOT NULL with a default, so every existing row becomes
-- 'human' with no backfill and no lock contention beyond the column add.
ALTER TABLE "CanvasTextCoding" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'human';

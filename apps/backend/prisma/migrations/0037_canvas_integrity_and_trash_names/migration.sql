-- A soft-deleted canvas must not reserve its former name forever. PostgreSQL
-- partial indexes express the real invariant: names are unique among LIVE
-- canvases owned by a dashboard, while any number of historical trash rows may
-- retain their original label.
DROP INDEX IF EXISTS "CodingCanvas_dashboardAccessId_name_key";
CREATE UNIQUE INDEX "CodingCanvas_live_dashboardAccessId_name_key"
  ON "CodingCanvas"("dashboardAccessId", "name")
  WHERE "deletedAt" IS NULL;

-- Bulk auto-code retries use this nullable fingerprint with createMany /
-- skipDuplicates. Existing and manual codings remain NULL and are unaffected.
ALTER TABLE "CanvasTextCoding" ADD COLUMN "autoCodeKey" TEXT;
CREATE UNIQUE INDEX "CanvasTextCoding_autoCodeKey_key" ON "CanvasTextCoding"("autoCodeKey");

-- Relation columns Postgres does not index automatically. CanvasMemo.canvasId
-- is filtered on every canvas open; the other three on admin/collaboration paths.
-- Small tables today; IF NOT EXISTS keeps a re-run harmless.
CREATE INDEX IF NOT EXISTS "CanvasMemo_canvasId_idx" ON "CanvasMemo"("canvasId");
CREATE INDEX IF NOT EXISTS "CanvasTemplate_createdBy_idx" ON "CanvasTemplate"("createdBy");
CREATE INDEX IF NOT EXISTS "CanvasCollaborator_invitedBy_idx" ON "CanvasCollaborator"("invitedBy");
CREATE INDEX IF NOT EXISTS "TranscriptionJob_fileUploadId_idx" ON "TranscriptionJob"("fileUploadId");

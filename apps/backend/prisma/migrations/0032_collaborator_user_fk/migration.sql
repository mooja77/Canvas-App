-- Add real foreign keys from CanvasCollaborator to User so deleting a user
-- cleans up their collaborator grants (Cascade) and nulls the inviter
-- reference (SetNull) instead of orphaning rows that still count against the
-- owner's seat limit. Verified 0 orphan rows on prod before applying.

ALTER TABLE "CanvasCollaborator"
  ADD CONSTRAINT "CanvasCollaborator_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanvasCollaborator"
  ADD CONSTRAINT "CanvasCollaborator_invitedBy_fkey"
  FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

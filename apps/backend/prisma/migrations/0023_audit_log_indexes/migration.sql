-- Sprint E reliability: add indexes on AuditLog to support the new user-facing
-- audit-trail endpoint (lookup by resourceId DESC) and the Quality panel's
-- category-filter queries (resource + action).

CREATE INDEX IF NOT EXISTS "AuditLog_resourceId_idx" ON "AuditLog"("resourceId");
CREATE INDEX IF NOT EXISTS "AuditLog_resource_action_idx" ON "AuditLog"("resource", "action");

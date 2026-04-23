-- Session invalidation on credential change.
-- Any JWT whose `iat` is earlier than this timestamp is rejected by auth middleware.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionsInvalidAt" TIMESTAMP(3);

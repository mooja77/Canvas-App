-- 14-day Pro trial for free-tier signups. Auth middleware treats users as
-- 'pro' until trialEndsAt elapses. Nullable: existing users created before
-- this migration get NULL (= no trial, original free-forever behavior).
ALTER TABLE "User" ADD COLUMN "trialEndsAt" TIMESTAMP(3);

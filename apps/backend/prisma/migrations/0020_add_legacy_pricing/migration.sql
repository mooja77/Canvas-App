-- Add legacyPricing flag for pricing v2 grandfather.
-- All existing users get TRUE (grandfathered to $12 Pro);
-- new signups after 2026-05-13 default to FALSE (will see v2 prices).

ALTER TABLE "User" ADD COLUMN "legacyPricing" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing users — anyone created BEFORE this migration is
-- considered legacy. Stripe subscriptions for these users keep their
-- existing Price IDs and continue billing at the old rates.
UPDATE "User" SET "legacyPricing" = true WHERE "createdAt" < NOW();

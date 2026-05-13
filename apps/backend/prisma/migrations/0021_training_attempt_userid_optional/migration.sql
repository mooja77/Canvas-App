-- Make TrainingAttempt.userId nullable so legacy access-code sessions (which
-- have no User row) can still record attempts without violating the FK that
-- migration 0019 added. Real User-authenticated attempts continue to cascade
-- on user deletion via the existing constraint.

ALTER TABLE "TrainingAttempt" ALTER COLUMN "userId" DROP NOT NULL;

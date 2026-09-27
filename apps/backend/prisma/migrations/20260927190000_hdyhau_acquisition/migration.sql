-- Additive: how-did-you-hear-about-us answer, asked once after signup.
ALTER TABLE "User"
  ADD COLUMN "acquisitionChannel" TEXT,
  ADD COLUMN "acquisitionOtherText" TEXT,
  ADD COLUMN "acquisitionRespondedAt" TIMESTAMP(3);

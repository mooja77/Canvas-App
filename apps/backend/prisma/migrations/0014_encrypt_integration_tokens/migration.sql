-- Integration tokens are now AES-256-GCM encrypted. Add the iv/tag fields
-- required to decrypt. Nullable so any pre-existing rows (written in
-- plaintext before this migration) aren't rejected — they'll need to be
-- reconnected by the user to produce valid ciphertext.
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "accessTokenIv" TEXT;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "accessTokenTag" TEXT;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "refreshTokenIv" TEXT;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "refreshTokenTag" TEXT;

-- CreateTable
CREATE TABLE "UserAiConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "apiKeyEncrypted" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "apiKeyTag" TEXT NOT NULL,
    "model" TEXT,
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAiConfig_userId_key" ON "UserAiConfig"("userId");

-- AddForeignKey
ALTER TABLE "UserAiConfig" ADD CONSTRAINT "UserAiConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

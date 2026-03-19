-- AlterTable
ALTER TABLE "CanvasTranscript" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "CanvasTranscript" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "CanvasTranscript" ADD COLUMN "locationName" TEXT;

-- CreateTable
CREATE TABLE "ResearchRepository" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryInsight" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "canvasId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepositoryInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchRepository_userId_name_key" ON "ResearchRepository"("userId", "name");

-- CreateIndex
CREATE INDEX "RepositoryInsight_repositoryId_idx" ON "RepositoryInsight"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_userId_provider_key" ON "Integration"("userId", "provider");

-- AddForeignKey
ALTER TABLE "ResearchRepository" ADD CONSTRAINT "ResearchRepository_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryInsight" ADD CONSTRAINT "RepositoryInsight_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "ResearchRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

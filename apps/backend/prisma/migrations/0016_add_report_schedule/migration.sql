-- ReportSchedule table — backs the hourly reportScheduler job (apps/backend/src/jobs/reportScheduler.ts).
-- Was missing in prod, causing prismaReportSchedule.findMany() to throw every hour:
-- "The table public.ReportSchedule does not exist in the current database".
-- The model exists in schema.prisma since 2026 but never had a migration generated.

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canvasId" TEXT,
    "teamId" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "dayOfWeek" INTEGER DEFAULT 1,
    "lastSent" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportSchedule_userId_idx" ON "ReportSchedule"("userId");

-- CreateIndex
CREATE INDEX "ReportSchedule_enabled_lastSent_idx" ON "ReportSchedule"("enabled", "lastSent");

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

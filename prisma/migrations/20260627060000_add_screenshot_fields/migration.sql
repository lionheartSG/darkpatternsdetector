-- AlterTable
ALTER TABLE "Scan" ADD COLUMN IF NOT EXISTS "viewportScreenshot" TEXT;
ALTER TABLE "Scan" ADD COLUMN IF NOT EXISTS "screenshotCapturedAt" TIMESTAMP(3);

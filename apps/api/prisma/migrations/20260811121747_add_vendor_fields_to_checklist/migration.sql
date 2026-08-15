-- AlterTable
ALTER TABLE "event_checklist" ADD COLUMN     "needs_vendor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vendor_category" TEXT;

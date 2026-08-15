-- AlterTable
ALTER TABLE "event_checklist" ADD COLUMN     "notified_at" TIMESTAMP(3),
ADD COLUMN     "notify_by_email" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notify_by_sms" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "event_checklist_due_date_is_completed_idx" ON "event_checklist"("due_date", "is_completed");

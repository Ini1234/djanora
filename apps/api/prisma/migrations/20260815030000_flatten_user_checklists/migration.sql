DROP TABLE "user_checklist_items";

ALTER TABLE "user_checklists" ADD COLUMN "event_checklist_id" TEXT;
ALTER TABLE "user_checklists" ADD COLUMN "is_completed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_checklists" ADD COLUMN "due_date" DATE;

CREATE UNIQUE INDEX "user_checklists_event_checklist_id_key" ON "user_checklists"("event_checklist_id");
DROP INDEX IF EXISTS "user_checklists_user_id_created_at_idx";
CREATE INDEX "user_checklists_user_id_due_date_idx" ON "user_checklists"("user_id", "due_date");

ALTER TABLE "user_checklists" ADD CONSTRAINT "user_checklists_event_checklist_id_fkey" FOREIGN KEY ("event_checklist_id") REFERENCES "event_checklist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

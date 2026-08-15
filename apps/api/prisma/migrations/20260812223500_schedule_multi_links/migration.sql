-- Create join tables
CREATE TABLE "event_schedule_budget_links" (
    "schedule_item_id" TEXT NOT NULL,
    "budget_item_id" TEXT NOT NULL,

    CONSTRAINT "event_schedule_budget_links_pkey" PRIMARY KEY ("schedule_item_id","budget_item_id")
);

CREATE TABLE "event_schedule_checklist_links" (
    "schedule_item_id" TEXT NOT NULL,
    "checklist_item_id" TEXT NOT NULL,

    CONSTRAINT "event_schedule_checklist_links_pkey" PRIMARY KEY ("schedule_item_id","checklist_item_id")
);

-- Copy existing single links
INSERT INTO "event_schedule_budget_links" ("schedule_item_id", "budget_item_id")
SELECT "id", "budget_item_id" FROM "event_schedule_items" WHERE "budget_item_id" IS NOT NULL;

INSERT INTO "event_schedule_checklist_links" ("schedule_item_id", "checklist_item_id")
SELECT "id", "checklist_item_id" FROM "event_schedule_items" WHERE "checklist_item_id" IS NOT NULL;

-- Indexes + FKs
CREATE INDEX "event_schedule_budget_links_budget_item_id_idx" ON "event_schedule_budget_links"("budget_item_id");
CREATE INDEX "event_schedule_checklist_links_checklist_item_id_idx" ON "event_schedule_checklist_links"("checklist_item_id");

ALTER TABLE "event_schedule_budget_links" ADD CONSTRAINT "event_schedule_budget_links_schedule_item_id_fkey" FOREIGN KEY ("schedule_item_id") REFERENCES "event_schedule_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_schedule_budget_links" ADD CONSTRAINT "event_schedule_budget_links_budget_item_id_fkey" FOREIGN KEY ("budget_item_id") REFERENCES "event_budget_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_schedule_checklist_links" ADD CONSTRAINT "event_schedule_checklist_links_schedule_item_id_fkey" FOREIGN KEY ("schedule_item_id") REFERENCES "event_schedule_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_schedule_checklist_links" ADD CONSTRAINT "event_schedule_checklist_links_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "event_checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old single FKs
ALTER TABLE "event_schedule_items" DROP CONSTRAINT IF EXISTS "event_schedule_items_budget_item_id_fkey";
ALTER TABLE "event_schedule_items" DROP CONSTRAINT IF EXISTS "event_schedule_items_checklist_item_id_fkey";
DROP INDEX IF EXISTS "event_schedule_items_budget_item_id_idx";
DROP INDEX IF EXISTS "event_schedule_items_checklist_item_id_idx";
ALTER TABLE "event_schedule_items" DROP COLUMN IF EXISTS "budget_item_id";
ALTER TABLE "event_schedule_items" DROP COLUMN IF EXISTS "checklist_item_id";

-- CreateTable
CREATE TABLE "event_schedule_items" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "location" TEXT,
    "budget_item_id" TEXT,
    "checklist_item_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_schedule_items_event_id_idx" ON "event_schedule_items"("event_id");

-- CreateIndex
CREATE INDEX "event_schedule_items_budget_item_id_idx" ON "event_schedule_items"("budget_item_id");

-- CreateIndex
CREATE INDEX "event_schedule_items_checklist_item_id_idx" ON "event_schedule_items"("checklist_item_id");

-- AddForeignKey
ALTER TABLE "event_schedule_items" ADD CONSTRAINT "event_schedule_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_schedule_items" ADD CONSTRAINT "event_schedule_items_budget_item_id_fkey" FOREIGN KEY ("budget_item_id") REFERENCES "event_budget_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_schedule_items" ADD CONSTRAINT "event_schedule_items_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "event_checklist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

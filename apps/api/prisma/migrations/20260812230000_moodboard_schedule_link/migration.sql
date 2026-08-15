ALTER TABLE "mood_board_items" ADD COLUMN "schedule_item_id" TEXT;

CREATE INDEX "mood_board_items_schedule_item_id_idx" ON "mood_board_items"("schedule_item_id");

ALTER TABLE "mood_board_items" ADD CONSTRAINT "mood_board_items_schedule_item_id_fkey" FOREIGN KEY ("schedule_item_id") REFERENCES "event_schedule_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "mood_board_items" ADD COLUMN     "budget_item_id" TEXT,
ADD COLUMN     "checklist_item_id" TEXT;

-- CreateIndex
CREATE INDEX "mood_board_items_checklist_item_id_idx" ON "mood_board_items"("checklist_item_id");

-- CreateIndex
CREATE INDEX "mood_board_items_budget_item_id_idx" ON "mood_board_items"("budget_item_id");

-- AddForeignKey
ALTER TABLE "mood_board_items" ADD CONSTRAINT "mood_board_items_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "event_checklist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_board_items" ADD CONSTRAINT "mood_board_items_budget_item_id_fkey" FOREIGN KEY ("budget_item_id") REFERENCES "event_budget_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

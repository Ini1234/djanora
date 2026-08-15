-- DropIndex
DROP INDEX "event_budget_items_event_id_category_key";

-- AlterTable
ALTER TABLE "event_budget_items" ADD COLUMN     "label" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "vendor_name" TEXT;

-- CreateTable
CREATE TABLE "budget_receipts" (
    "id" TEXT NOT NULL,
    "budget_item_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_receipts_budget_item_id_idx" ON "budget_receipts"("budget_item_id");

-- AddForeignKey
ALTER TABLE "budget_receipts" ADD CONSTRAINT "budget_receipts_budget_item_id_fkey" FOREIGN KEY ("budget_item_id") REFERENCES "event_budget_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

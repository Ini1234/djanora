-- AlterTable
ALTER TABLE "event_budget_items" ADD COLUMN     "vendor_profile_id" TEXT;

-- CreateIndex
CREATE INDEX "event_budget_items_vendor_profile_id_idx" ON "event_budget_items"("vendor_profile_id");

-- AddForeignKey
ALTER TABLE "event_budget_items" ADD CONSTRAINT "event_budget_items_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

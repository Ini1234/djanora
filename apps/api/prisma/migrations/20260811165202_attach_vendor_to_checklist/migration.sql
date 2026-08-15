-- AlterTable
ALTER TABLE "event_checklist" ADD COLUMN     "user_vendor_contact_id" TEXT,
ADD COLUMN     "vendor_name" TEXT,
ADD COLUMN     "vendor_profile_id" TEXT;

-- CreateIndex
CREATE INDEX "event_checklist_vendor_profile_id_idx" ON "event_checklist"("vendor_profile_id");

-- CreateIndex
CREATE INDEX "event_checklist_user_vendor_contact_id_idx" ON "event_checklist"("user_vendor_contact_id");

-- AddForeignKey
ALTER TABLE "event_checklist" ADD CONSTRAINT "event_checklist_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_checklist" ADD CONSTRAINT "event_checklist_user_vendor_contact_id_fkey" FOREIGN KEY ("user_vendor_contact_id") REFERENCES "user_vendor_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `vendor_email` on the `event_budget_items` table. All the data in the column will be lost.
  - You are about to drop the column `vendor_phone` on the `event_budget_items` table. All the data in the column will be lost.
  - You are about to drop the column `vendor_website` on the `event_budget_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "event_budget_items" DROP COLUMN "vendor_email",
DROP COLUMN "vendor_phone",
DROP COLUMN "vendor_website",
ADD COLUMN     "user_vendor_contact_id" TEXT;

-- CreateTable
CREATE TABLE "user_vendor_contacts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" "VendorCategory",
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "website" VARCHAR(500),
    "notes" TEXT,
    "vendor_profile_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_vendor_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_vendor_contacts_vendor_profile_id_key" ON "user_vendor_contacts"("vendor_profile_id");

-- CreateIndex
CREATE INDEX "user_vendor_contacts_user_id_idx" ON "user_vendor_contacts"("user_id");

-- CreateIndex
CREATE INDEX "user_vendor_contacts_user_id_category_idx" ON "user_vendor_contacts"("user_id", "category");

-- CreateIndex
CREATE INDEX "event_budget_items_user_vendor_contact_id_idx" ON "event_budget_items"("user_vendor_contact_id");

-- AddForeignKey
ALTER TABLE "user_vendor_contacts" ADD CONSTRAINT "user_vendor_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vendor_contacts" ADD CONSTRAINT "user_vendor_contacts_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_budget_items" ADD CONSTRAINT "event_budget_items_user_vendor_contact_id_fkey" FOREIGN KEY ("user_vendor_contact_id") REFERENCES "user_vendor_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

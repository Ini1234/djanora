-- CreateTable
CREATE TABLE "event_checklist_vendors" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "vendor_profile_id" TEXT,
    "user_vendor_contact_id" TEXT,
    "name" VARCHAR(120),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_checklist_vendors_pkey" PRIMARY KEY ("id")
);

-- Copy existing single vendor/contact onto the join table
INSERT INTO "event_checklist_vendors" ("id", "checklist_id", "vendor_profile_id", "user_vendor_contact_id", "name", "sort_order")
SELECT
    ('clv' || substr(md5(random()::text || ec."id"), 1, 22)),
    ec."id",
    ec."vendor_profile_id",
    ec."user_vendor_contact_id",
    COALESCE(vp."business_name", uvc."name"),
    0
FROM "event_checklist" ec
LEFT JOIN "vendor_profiles" vp ON vp."id" = ec."vendor_profile_id"
LEFT JOIN "user_vendor_contacts" uvc ON uvc."id" = ec."user_vendor_contact_id"
WHERE ec."vendor_profile_id" IS NOT NULL OR ec."user_vendor_contact_id" IS NOT NULL;

-- CreateIndex
CREATE INDEX "event_checklist_vendors_checklist_id_sort_order_idx" ON "event_checklist_vendors"("checklist_id", "sort_order");
CREATE INDEX "event_checklist_vendors_vendor_profile_id_idx" ON "event_checklist_vendors"("vendor_profile_id");
CREATE INDEX "event_checklist_vendors_user_vendor_contact_id_idx" ON "event_checklist_vendors"("user_vendor_contact_id");

-- AddForeignKey
ALTER TABLE "event_checklist_vendors" ADD CONSTRAINT "event_checklist_vendors_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "event_checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_checklist_vendors" ADD CONSTRAINT "event_checklist_vendors_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_checklist_vendors" ADD CONSTRAINT "event_checklist_vendors_user_vendor_contact_id_fkey" FOREIGN KEY ("user_vendor_contact_id") REFERENCES "user_vendor_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old single-vendor columns
ALTER TABLE "event_checklist" DROP CONSTRAINT IF EXISTS "event_checklist_vendor_profile_id_fkey";
ALTER TABLE "event_checklist" DROP CONSTRAINT IF EXISTS "event_checklist_user_vendor_contact_id_fkey";
DROP INDEX IF EXISTS "event_checklist_vendor_profile_id_idx";
DROP INDEX IF EXISTS "event_checklist_user_vendor_contact_id_idx";
ALTER TABLE "event_checklist" DROP COLUMN IF EXISTS "vendor_profile_id";
ALTER TABLE "event_checklist" DROP COLUMN IF EXISTS "user_vendor_contact_id";

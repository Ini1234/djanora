-- Azure overlapping containers still run the previous Prisma client, which
-- SELECTs these columns. Restore them (unused by the new schema) so deploys
-- do not 500 while the old process drains.

ALTER TABLE "event_checklist" ADD COLUMN IF NOT EXISTS "vendor_profile_id" TEXT;
ALTER TABLE "event_checklist" ADD COLUMN IF NOT EXISTS "user_vendor_contact_id" TEXT;

CREATE INDEX IF NOT EXISTS "event_checklist_vendor_profile_id_idx"
  ON "event_checklist"("vendor_profile_id");
CREATE INDEX IF NOT EXISTS "event_checklist_user_vendor_contact_id_idx"
  ON "event_checklist"("user_vendor_contact_id");

UPDATE "event_checklist" AS ec
SET
  "vendor_profile_id" = v."vendor_profile_id",
  "user_vendor_contact_id" = v."user_vendor_contact_id"
FROM (
  SELECT DISTINCT ON ("checklist_id")
    "checklist_id",
    "vendor_profile_id",
    "user_vendor_contact_id"
  FROM "event_checklist_vendors"
  ORDER BY "checklist_id", "sort_order" ASC, "created_at" ASC
) AS v
WHERE ec."id" = v."checklist_id";

DO $$ BEGIN
  ALTER TABLE "event_checklist"
    ADD CONSTRAINT "event_checklist_vendor_profile_id_fkey"
    FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "event_checklist"
    ADD CONSTRAINT "event_checklist_user_vendor_contact_id_fkey"
    FOREIGN KEY ("user_vendor_contact_id") REFERENCES "user_vendor_contacts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

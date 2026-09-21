-- AlterTable
ALTER TABLE "event_site_photos" ADD COLUMN "section_id" TEXT;
ALTER TABLE "event_site_photos" ADD COLUMN "person_id" TEXT;
ALTER TABLE "event_site_photos" ADD COLUMN "alt" VARCHAR(200) NOT NULL DEFAULT '';

-- AddForeignKey
ALTER TABLE "event_site_photos" ADD CONSTRAINT "event_site_photos_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "event_site_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "event_site_photos_section_id_idx" ON "event_site_photos"("section_id");

CREATE UNIQUE INDEX "event_site_photos_section_hero_key"
  ON "event_site_photos"("section_id")
  WHERE "section_id" IS NOT NULL AND "person_id" IS NULL;

CREATE UNIQUE INDEX "event_site_photos_section_person_key"
  ON "event_site_photos"("section_id", "person_id")
  WHERE "person_id" IS NOT NULL;

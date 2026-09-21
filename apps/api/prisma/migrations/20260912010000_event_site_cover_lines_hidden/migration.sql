-- AlterTable
ALTER TABLE "event_sites" ALTER COLUMN "show_event_type" SET DEFAULT false;
ALTER TABLE "event_sites" ALTER COLUMN "show_event_title" SET DEFAULT false;
UPDATE "event_sites" SET "show_event_type" = false, "show_event_title" = false;

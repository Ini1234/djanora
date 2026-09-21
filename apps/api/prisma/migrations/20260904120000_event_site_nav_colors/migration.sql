-- AlterTable
ALTER TABLE "event_sites" ADD COLUMN "nav_placement" VARCHAR(16) NOT NULL DEFAULT 'top';
ALTER TABLE "event_sites" ADD COLUMN "custom_colors" JSONB;

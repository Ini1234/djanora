-- AlterTable
ALTER TABLE "event_sites" ADD COLUMN "nav_border" VARCHAR(8) NOT NULL DEFAULT 'on';
ALTER TABLE "event_sites" ADD COLUMN "nav_border_width" VARCHAR(16) NOT NULL DEFAULT 'thin';
ALTER TABLE "event_sites" ADD COLUMN "nav_border_style" VARCHAR(16) NOT NULL DEFAULT 'solid';

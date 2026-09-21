-- AlterTable
ALTER TABLE "event_sites" ADD COLUMN "nav_style" VARCHAR(16) NOT NULL DEFAULT 'line';
ALTER TABLE "event_sites" ADD COLUMN "nav_align" VARCHAR(16) NOT NULL DEFAULT 'split';

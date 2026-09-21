-- AlterTable
ALTER TABLE "event_sites" ADD COLUMN "nav_name" VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE "event_sites" ALTER COLUMN "nav_align" SET DEFAULT 'above';

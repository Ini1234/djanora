-- AlterEnum
ALTER TYPE "EventSurface" ADD VALUE 'SITE';

-- AlterTable
ALTER TABLE "event_schedule_items" ADD COLUMN "show_on_site" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "EventSiteStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "EventSiteAccessMode" AS ENUM ('OPEN', 'INVITED_ONLY');
CREATE TYPE "EventSiteSectionType" AS ENUM ('COVER', 'ABOUT', 'SCHEDULE', 'WHERE', 'PEOPLE', 'RSVP', 'PHOTOS', 'FAQ', 'GIFTS', 'TRAVEL');

-- CreateTable
CREATE TABLE "event_sites" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "EventSiteStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "owner_access_mode" "EventSiteAccessMode" NOT NULL DEFAULT 'INVITED_ONLY',
    "theme_preset" VARCHAR(32) NOT NULL DEFAULT 'linen',
    "font_pair" VARCHAR(32) NOT NULL DEFAULT 'serif-sans',
    "color_palette" VARCHAR(32) NOT NULL DEFAULT 'ivory-gold',
    "button_style" VARCHAR(32) NOT NULL DEFAULT 'pill',
    "cover_layout" VARCHAR(32) NOT NULL DEFAULT 'full-bleed',
    "cover_photo_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_sites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_sites_event_id_key" ON "event_sites"("event_id");
CREATE UNIQUE INDEX "event_sites_slug_key" ON "event_sites"("slug");

-- CreateTable
CREATE TABLE "event_site_includes" (
    "site_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "access_mode" "EventSiteAccessMode" NOT NULL DEFAULT 'INVITED_ONLY',
    "has_own_guest_list" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "event_site_includes_pkey" PRIMARY KEY ("site_id","event_id")
);

CREATE INDEX "event_site_includes_event_id_idx" ON "event_site_includes"("event_id");

-- CreateTable
CREATE TABLE "event_site_sections" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "type" "EventSiteSectionType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "event_site_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_site_sections_site_id_type_key" ON "event_site_sections"("site_id", "type");
CREATE INDEX "event_site_sections_site_id_idx" ON "event_site_sections"("site_id");

-- CreateTable
CREATE TABLE "event_site_photos" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_site_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_site_photos_site_id_idx" ON "event_site_photos"("site_id");

-- AddForeignKey
ALTER TABLE "event_sites" ADD CONSTRAINT "event_sites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_site_includes" ADD CONSTRAINT "event_site_includes_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "event_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_site_includes" ADD CONSTRAINT "event_site_includes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_site_sections" ADD CONSTRAINT "event_site_sections_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "event_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_site_photos" ADD CONSTRAINT "event_site_photos_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "event_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

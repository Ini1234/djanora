-- AlterEnum
ALTER TYPE "EventSurface" ADD VALUE 'PARTY';

-- CreateEnum
CREATE TYPE "EventPartySide" AS ENUM ('BRIDE', 'GROOM', 'OTHER');

-- CreateEnum
CREATE TYPE "EventPartyStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- AlterTable
ALTER TABLE "events" ADD COLUMN "party_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "event_party_members" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "side" "EventPartySide" NOT NULL DEFAULT 'OTHER',
    "group" TEXT,
    "bio" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "show_on_site" BOOLEAN NOT NULL DEFAULT false,
    "status" "EventPartyStatus" NOT NULL DEFAULT 'PENDING',
    "paired_with_id" TEXT,
    "photo_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_party_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_party_members_paired_with_id_key" ON "event_party_members"("paired_with_id");

-- CreateIndex
CREATE INDEX "event_party_members_event_id_idx" ON "event_party_members"("event_id");

-- AddForeignKey
ALTER TABLE "event_party_members" ADD CONSTRAINT "event_party_members_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_party_members" ADD CONSTRAINT "event_party_members_paired_with_id_fkey" FOREIGN KEY ("paired_with_id") REFERENCES "event_party_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

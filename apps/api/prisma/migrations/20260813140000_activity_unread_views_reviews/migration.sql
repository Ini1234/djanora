-- CreateEnum
CREATE TYPE "EventActivityAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'COMPLETED', 'COMMENTED', 'INVITED');

-- AlterTable
ALTER TABLE "vendor_profiles" ADD COLUMN "profile_views" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN "review_requested_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "event_activities" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" "EventActivityAction" NOT NULL,
    "surface" "EventSurface",
    "summary" TEXT NOT NULL,
    "subject_type" TEXT,
    "subject_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_surface_reads" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_surface_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_activities_event_id_created_at_idx" ON "event_activities"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "event_activities_event_id_surface_created_at_idx" ON "event_activities"("event_id", "surface", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_surface_reads_event_id_user_id_surface_key" ON "event_surface_reads"("event_id", "user_id", "surface");

-- CreateIndex
CREATE INDEX "event_surface_reads_user_id_idx" ON "event_surface_reads"("user_id");

-- AddForeignKey
ALTER TABLE "event_activities" ADD CONSTRAINT "event_activities_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_activities" ADD CONSTRAINT "event_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_surface_reads" ADD CONSTRAINT "event_surface_reads_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_surface_reads" ADD CONSTRAINT "event_surface_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

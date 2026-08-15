-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('PENDING', 'ATTENDING', 'DECLINED', 'MAYBE');

-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "plus_one_allowed" BOOLEAN NOT NULL DEFAULT false,
    "table_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_invites" (
    "id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "sent_via" TEXT,
    "expires_at" TIMESTAMP(3),
    "custom_note" TEXT,
    "rsvp_status" "RsvpStatus" NOT NULL DEFAULT 'PENDING',
    "rsvp_at" TIMESTAMP(3),
    "plus_one_name" TEXT,
    "dietary_note" TEXT,
    "guest_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guests_event_id_idx" ON "guests"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_invites_guest_id_key" ON "guest_invites"("guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_invites_token_key" ON "guest_invites"("token");

-- CreateIndex
CREATE INDEX "guest_invites_event_id_idx" ON "guest_invites"("event_id");

-- CreateIndex
CREATE INDEX "guest_invites_token_idx" ON "guest_invites"("token");

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_invites" ADD CONSTRAINT "guest_invites_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_invites" ADD CONSTRAINT "guest_invites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

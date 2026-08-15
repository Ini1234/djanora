-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'BRIDE_PRICE';
ALTER TYPE "EventType" ADD VALUE 'COURT';
ALTER TYPE "EventType" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "events" ADD COLUMN "wedding_id" TEXT;
ALTER TABLE "events" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "weddings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "total_budget" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "weddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_members" (
    "id" TEXT NOT NULL,
    "wedding_id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "role" "EventMemberRole" NOT NULL,
    "token" TEXT NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wedding_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_ceremony_grants" (
    "id" TEXT NOT NULL,
    "wedding_member_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "surfaces" "EventSurface"[],

    CONSTRAINT "wedding_ceremony_grants_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "event_checklist" ADD COLUMN "assignee_user_id" TEXT;

-- CreateTable
CREATE TABLE "event_checklist_concealments" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "wedding_member_id" TEXT NOT NULL,

    CONSTRAINT "event_checklist_concealments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weddings_user_id_idx" ON "weddings"("user_id");
CREATE INDEX "weddings_deleted_at_idx" ON "weddings"("deleted_at");
CREATE UNIQUE INDEX "wedding_members_token_key" ON "wedding_members"("token");
CREATE UNIQUE INDEX "wedding_members_wedding_id_email_key" ON "wedding_members"("wedding_id", "email");
CREATE INDEX "wedding_members_wedding_id_idx" ON "wedding_members"("wedding_id");
CREATE INDEX "wedding_members_user_id_idx" ON "wedding_members"("user_id");
CREATE UNIQUE INDEX "wedding_ceremony_grants_wedding_member_id_event_id_key" ON "wedding_ceremony_grants"("wedding_member_id", "event_id");
CREATE INDEX "wedding_ceremony_grants_event_id_idx" ON "wedding_ceremony_grants"("event_id");
CREATE INDEX "events_wedding_id_idx" ON "events"("wedding_id");
CREATE INDEX "event_checklist_assignee_user_id_is_completed_idx" ON "event_checklist"("assignee_user_id", "is_completed");
CREATE UNIQUE INDEX "event_checklist_concealments_checklist_id_wedding_member_id_key" ON "event_checklist_concealments"("checklist_id", "wedding_member_id");

-- AddForeignKey
ALTER TABLE "weddings" ADD CONSTRAINT "weddings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_wedding_id_fkey" FOREIGN KEY ("wedding_id") REFERENCES "weddings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wedding_members" ADD CONSTRAINT "wedding_members_wedding_id_fkey" FOREIGN KEY ("wedding_id") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wedding_members" ADD CONSTRAINT "wedding_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wedding_members" ADD CONSTRAINT "wedding_members_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wedding_ceremony_grants" ADD CONSTRAINT "wedding_ceremony_grants_wedding_member_id_fkey" FOREIGN KEY ("wedding_member_id") REFERENCES "wedding_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wedding_ceremony_grants" ADD CONSTRAINT "wedding_ceremony_grants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_checklist" ADD CONSTRAINT "event_checklist_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_checklist_concealments" ADD CONSTRAINT "event_checklist_concealments_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "event_checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_checklist_concealments" ADD CONSTRAINT "event_checklist_concealments_wedding_member_id_fkey" FOREIGN KEY ("wedding_member_id") REFERENCES "wedding_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

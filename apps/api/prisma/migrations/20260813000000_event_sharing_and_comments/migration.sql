-- CreateEnum
CREATE TYPE "EventSurface" AS ENUM ('SCHEDULE', 'CHECKLIST', 'BUDGET', 'MOODBOARD', 'VENDORS', 'GUESTS');

-- CreateEnum
CREATE TYPE "EventMemberRole" AS ENUM ('EDITOR', 'COMMENTER', 'VIEWER');

-- CreateEnum
CREATE TYPE "EventCommentSubject" AS ENUM ('SCHEDULE_ITEM', 'CHECKLIST_ITEM', 'BUDGET_ITEM', 'MOOD_BOARD_ITEM', 'EVENT');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EVENT_INVITE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EVENT_COMMENT';

-- CreateTable
CREATE TABLE "event_members" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "role" "EventMemberRole" NOT NULL,
    "surfaces" "EventSurface"[],
    "invited_by_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_comments" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "subject_type" "EventCommentSubject" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "event_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_comment_mentions" (
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "event_comment_mentions_pkey" PRIMARY KEY ("comment_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_members_token_key" ON "event_members"("token");

-- CreateIndex
CREATE INDEX "event_members_user_id_idx" ON "event_members"("user_id");

-- CreateIndex
CREATE INDEX "event_members_email_idx" ON "event_members"("email");

-- CreateIndex
CREATE INDEX "event_members_event_id_idx" ON "event_members"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_members_event_id_email_key" ON "event_members"("event_id", "email");

-- CreateIndex
CREATE INDEX "event_comments_event_id_subject_type_subject_id_idx" ON "event_comments"("event_id", "subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "event_comments_parent_id_idx" ON "event_comments"("parent_id");

-- CreateIndex
CREATE INDEX "event_comment_mentions_user_id_idx" ON "event_comment_mentions"("user_id");

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "event_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comment_mentions" ADD CONSTRAINT "event_comment_mentions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "event_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comment_mentions" ADD CONSTRAINT "event_comment_mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

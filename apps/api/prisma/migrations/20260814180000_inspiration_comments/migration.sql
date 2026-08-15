ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INSPIRATION_COMMENT';

CREATE TABLE "inspiration_comments" (
    "id" TEXT NOT NULL,
    "inspiration_item_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspiration_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inspiration_comments_inspiration_item_id_created_at_idx" ON "inspiration_comments"("inspiration_item_id", "created_at");
CREATE INDEX "inspiration_comments_author_id_idx" ON "inspiration_comments"("author_id");

ALTER TABLE "inspiration_comments" ADD CONSTRAINT "inspiration_comments_inspiration_item_id_fkey" FOREIGN KEY ("inspiration_item_id") REFERENCES "inspiration_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inspiration_comments" ADD CONSTRAINT "inspiration_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

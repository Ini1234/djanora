-- AlterTable
ALTER TABLE "users" ADD COLUMN "personal_checklist_seeded_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_checklist_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "due_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "href" TEXT,
    "seed_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_checklist_items_user_id_seed_key_key" ON "user_checklist_items"("user_id", "seed_key");

-- CreateIndex
CREATE INDEX "user_checklist_items_user_id_sort_order_idx" ON "user_checklist_items"("user_id", "sort_order");

-- AddForeignKey
ALTER TABLE "user_checklist_items" ADD CONSTRAINT "user_checklist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "InspirationCategory" AS ENUM ('PERFORMANCE', 'VENUE', 'DECOR', 'MUSIC', 'FASHION', 'FOOD', 'OTHER');

-- CreateTable
CREATE TABLE "inspiration_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "InspirationCategory" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "image_url" TEXT,
    "location" TEXT,
    "price_range_from" DOUBLE PRECISION,
    "price_range_to" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "embedding" BYTEA,
    "vendor_profile_id" TEXT,
    "created_by_id" TEXT,
    "is_admin_curated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspiration_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_board_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "inspiration_item_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mood_board_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inspiration_items_category_idx" ON "inspiration_items"("category");

-- CreateIndex
CREATE INDEX "inspiration_items_vendor_profile_id_idx" ON "inspiration_items"("vendor_profile_id");

-- CreateIndex
CREATE INDEX "mood_board_items_event_id_idx" ON "mood_board_items"("event_id");

-- CreateIndex
CREATE INDEX "mood_board_items_user_id_idx" ON "mood_board_items"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mood_board_items_user_id_event_id_inspiration_item_id_key" ON "mood_board_items"("user_id", "event_id", "inspiration_item_id");

-- AddForeignKey
ALTER TABLE "inspiration_items" ADD CONSTRAINT "inspiration_items_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspiration_items" ADD CONSTRAINT "inspiration_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_board_items" ADD CONSTRAINT "mood_board_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_board_items" ADD CONSTRAINT "mood_board_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_board_items" ADD CONSTRAINT "mood_board_items_inspiration_item_id_fkey" FOREIGN KEY ("inspiration_item_id") REFERENCES "inspiration_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

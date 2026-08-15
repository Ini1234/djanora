-- CreateTable
CREATE TABLE "inspiration_likes" (
    "user_id" TEXT NOT NULL,
    "inspiration_item_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspiration_likes_pkey" PRIMARY KEY ("user_id","inspiration_item_id")
);

-- CreateTable
CREATE TABLE "vendor_favorites" (
    "user_id" TEXT NOT NULL,
    "vendor_profile_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_favorites_pkey" PRIMARY KEY ("user_id","vendor_profile_id")
);

-- CreateIndex
CREATE INDEX "inspiration_likes_inspiration_item_id_idx" ON "inspiration_likes"("inspiration_item_id");

-- CreateIndex
CREATE INDEX "vendor_favorites_vendor_profile_id_idx" ON "vendor_favorites"("vendor_profile_id");

-- AddForeignKey
ALTER TABLE "inspiration_likes" ADD CONSTRAINT "inspiration_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspiration_likes" ADD CONSTRAINT "inspiration_likes_inspiration_item_id_fkey" FOREIGN KEY ("inspiration_item_id") REFERENCES "inspiration_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_favorites" ADD CONSTRAINT "vendor_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_favorites" ADD CONSTRAINT "vendor_favorites_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

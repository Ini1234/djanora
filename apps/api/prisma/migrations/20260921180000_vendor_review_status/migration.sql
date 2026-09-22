-- CreateEnum
CREATE TYPE "VendorReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "vendor_profiles"
  ADD COLUMN "review_status" "VendorReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "review_note" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_by_id" TEXT;

-- Grandfather vendors that were already live.
UPDATE "vendor_profiles"
SET "review_status" = 'APPROVED',
    "is_verified" = true,
    "is_active" = true
WHERE "is_active" = true;

UPDATE "vendor_profiles"
SET "review_status" = 'SUSPENDED',
    "is_verified" = false
WHERE "is_active" = false;

-- CreateIndex
CREATE INDEX "vendor_profiles_review_status_idx" ON "vendor_profiles"("review_status");

-- AddForeignKey
ALTER TABLE "vendor_profiles"
  ADD CONSTRAINT "vendor_profiles_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- First admin (out of band; onboarding cannot mint ADMIN).
UPDATE "users"
SET "role" = 'ADMIN'
WHERE lower("email") = 'ekkythe3@gmail.com';

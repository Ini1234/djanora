-- AlterTable
ALTER TABLE "users" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country_of_origin" TEXT,
ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "onboarding_completed_at" TIMESTAMP(3),
ADD COLUMN     "tribe" "Tribe";

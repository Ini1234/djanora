-- AlterTable
ALTER TABLE "users" ADD COLUMN "tribes" "Tribe"[] NOT NULL DEFAULT ARRAY[]::"Tribe"[];

UPDATE "users" SET "tribes" = ARRAY["tribe"]::"Tribe"[] WHERE "tribe" IS NOT NULL;

ALTER TABLE "users" DROP COLUMN "tribe";

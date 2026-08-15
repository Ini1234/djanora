/*
  Warnings:

  - You are about to drop the column `tribe` on the `events` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "events" DROP COLUMN "tribe",
ADD COLUMN     "tribes" "Tribe"[];

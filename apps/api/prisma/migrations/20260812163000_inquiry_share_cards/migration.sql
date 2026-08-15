-- AlterEnum
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'BOOKED';

-- CreateEnum
CREATE TYPE "InquiryMessageKind" AS ENUM ('TEXT', 'QUOTE', 'LINK');

-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN "booked_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "inquiry_messages" ADD COLUMN "kind" "InquiryMessageKind" NOT NULL DEFAULT 'TEXT';
ALTER TABLE "inquiry_messages" ADD COLUMN "payload" JSONB;

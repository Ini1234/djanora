-- AlterTable
ALTER TABLE "assistant_threads" ADD COLUMN "transcript_key" TEXT;

UPDATE "assistant_threads"
SET "transcript_key" = id || '.json'
WHERE "transcript_key" IS NULL;

ALTER TABLE "assistant_threads" ALTER COLUMN "transcript_key" SET NOT NULL;

CREATE UNIQUE INDEX "assistant_threads_transcript_key_key" ON "assistant_threads"("transcript_key");

-- DropTable
DROP TABLE IF EXISTS "assistant_messages";

-- DropEnum
DROP TYPE IF EXISTS "AssistantMessageRole";

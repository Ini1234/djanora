ALTER TABLE "assistant_threads" ADD COLUMN "session_id" TEXT;

UPDATE "assistant_threads"
SET "session_id" = 'assistant:' || id
WHERE "session_id" IS NULL;

ALTER TABLE "assistant_threads" ALTER COLUMN "session_id" SET NOT NULL;

CREATE UNIQUE INDEX "assistant_threads_session_id_key" ON "assistant_threads"("session_id");

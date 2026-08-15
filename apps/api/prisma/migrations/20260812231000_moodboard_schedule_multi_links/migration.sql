CREATE TABLE "event_schedule_mood_board_links" (
    "schedule_item_id" TEXT NOT NULL,
    "mood_board_item_id" TEXT NOT NULL,

    CONSTRAINT "event_schedule_mood_board_links_pkey" PRIMARY KEY ("schedule_item_id","mood_board_item_id")
);

INSERT INTO "event_schedule_mood_board_links" ("schedule_item_id", "mood_board_item_id")
SELECT "schedule_item_id", "id" FROM "mood_board_items" WHERE "schedule_item_id" IS NOT NULL;

CREATE INDEX "event_schedule_mood_board_links_mood_board_item_id_idx" ON "event_schedule_mood_board_links"("mood_board_item_id");

ALTER TABLE "event_schedule_mood_board_links" ADD CONSTRAINT "event_schedule_mood_board_links_schedule_item_id_fkey" FOREIGN KEY ("schedule_item_id") REFERENCES "event_schedule_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_schedule_mood_board_links" ADD CONSTRAINT "event_schedule_mood_board_links_mood_board_item_id_fkey" FOREIGN KEY ("mood_board_item_id") REFERENCES "mood_board_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mood_board_items" DROP CONSTRAINT IF EXISTS "mood_board_items_schedule_item_id_fkey";
DROP INDEX IF EXISTS "mood_board_items_schedule_item_id_idx";
ALTER TABLE "mood_board_items" DROP COLUMN IF EXISTS "schedule_item_id";

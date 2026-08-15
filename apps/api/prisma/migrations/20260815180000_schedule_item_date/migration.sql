ALTER TABLE "event_schedule_items" ADD COLUMN "date" VARCHAR(10);

UPDATE "event_schedule_items" AS s
SET "date" = to_char(e."estimated_date", 'YYYY-MM-DD')
FROM "events" e
WHERE s."event_id" = e."id"
  AND e."parent_id" IS NULL
  AND e."estimated_date" IS NOT NULL
  AND s."date" IS NULL;

-- Existing rows without a name keep vendor or category as a fallback.
UPDATE "event_budget_items"
SET "label" = COALESCE(
  NULLIF(BTRIM("label"), ''),
  NULLIF(BTRIM("vendor_name"), ''),
  REPLACE("category"::text, '_', ' ')
)
WHERE "label" IS NULL OR BTRIM("label") = '';

ALTER TABLE "event_budget_items" ALTER COLUMN "label" SET NOT NULL;

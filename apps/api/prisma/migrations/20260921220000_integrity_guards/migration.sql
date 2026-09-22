-- Keep the oldest inquiry when the same sender already contacted a vendor
-- for the same event (including a null / "general" event).
DELETE FROM "inquiries" a
USING "inquiries" b
WHERE a."sender_id" = b."sender_id"
  AND a."vendor_profile_id" = b."vendor_profile_id"
  AND a."event_id" IS NOT DISTINCT FROM b."event_id"
  AND a."id" > b."id";

CREATE UNIQUE INDEX "inquiries_sender_vendor_event_key"
  ON "inquiries" ("sender_id", "vendor_profile_id", "event_id")
  NULLS NOT DISTINCT;

-- One accepted / linked planner seat per user per event.
DELETE FROM "event_members" a
USING "event_members" b
WHERE a."event_id" = b."event_id"
  AND a."user_id" IS NOT NULL
  AND a."user_id" = b."user_id"
  AND a."id" > b."id";

CREATE UNIQUE INDEX "event_members_event_id_user_id_key"
  ON "event_members" ("event_id", "user_id")
  WHERE "user_id" IS NOT NULL;

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_range_check"
  CHECK ("rating" >= 1 AND "rating" <= 5);

-- Soft-deleted owners must not stay on the public marketplace,
-- and their email must be free for a later Clerk account.
UPDATE "vendor_profiles" vp
SET
  "review_status" = 'SUSPENDED',
  "is_verified" = false,
  "is_active" = false
FROM "users" u
WHERE vp."user_id" = u."id"
  AND u."deleted_at" IS NOT NULL
  AND vp."review_status" = 'APPROVED';

UPDATE "users"
SET "email" = 'deleted+' || "id" || '@invalid.local'
WHERE "deleted_at" IS NOT NULL
  AND "email" NOT LIKE 'deleted+%@invalid.local';

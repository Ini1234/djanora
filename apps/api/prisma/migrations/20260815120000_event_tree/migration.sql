-- Event tree: parent/child on Event. Drop Wedding container tables.

ALTER TABLE "events" ADD COLUMN "parent_id" TEXT;

CREATE TABLE "event_sub_grants" (
    "id" TEXT NOT NULL,
    "event_member_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "surfaces" "EventSurface"[],

    CONSTRAINT "event_sub_grants_pkey" PRIMARY KEY ("id")
);

-- Parent events from existing weddings (reuse wedding id when free).
INSERT INTO "events" (
    "id", "user_id", "title", "event_type", "tribes", "theme",
    "total_budget", "currency", "sort_order", "created_at", "updated_at"
)
SELECT
    w."id",
    w."user_id",
    w."title",
    'CUSTOM',
    ARRAY['OTHER']::"Tribe"[],
    'FUSION',
    w."total_budget",
    w."currency",
    0,
    w."created_at",
    w."updated_at"
FROM "weddings" w
WHERE w."deleted_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "events" e WHERE e."id" = w."id");

INSERT INTO "events" (
    "id", "user_id", "title", "event_type", "tribes", "theme",
    "total_budget", "currency", "sort_order", "created_at", "updated_at"
)
SELECT
    'wp_' || w."id",
    w."user_id",
    w."title",
    'CUSTOM',
    ARRAY['OTHER']::"Tribe"[],
    'FUSION',
    w."total_budget",
    w."currency",
    0,
    w."created_at",
    w."updated_at"
FROM "weddings" w
WHERE w."deleted_at" IS NULL
  AND EXISTS (SELECT 1 FROM "events" e WHERE e."id" = w."id")
  AND NOT EXISTS (SELECT 1 FROM "events" e WHERE e."id" = 'wp_' || w."id");

UPDATE "events" e
SET "parent_id" = CASE
    WHEN EXISTS (SELECT 1 FROM "events" p WHERE p."id" = e."wedding_id") THEN e."wedding_id"
    ELSE 'wp_' || e."wedding_id"
END
WHERE e."wedding_id" IS NOT NULL;

INSERT INTO "event_members" (
    "id", "event_id", "user_id", "email", "role", "surfaces",
    "invited_by_id", "token", "accepted_at", "created_at", "updated_at"
)
SELECT
    wm."id",
    CASE
        WHEN EXISTS (SELECT 1 FROM "events" p WHERE p."id" = wm."wedding_id") THEN wm."wedding_id"
        ELSE 'wp_' || wm."wedding_id"
    END,
    wm."user_id",
    wm."email",
    wm."role",
    ARRAY[]::"EventSurface"[],
    wm."invited_by_id",
    wm."token",
    wm."accepted_at",
    wm."created_at",
    wm."updated_at"
FROM "wedding_members" wm
WHERE NOT EXISTS (SELECT 1 FROM "event_members" em WHERE em."id" = wm."id")
  AND NOT EXISTS (SELECT 1 FROM "event_members" em WHERE em."token" = wm."token");

INSERT INTO "event_sub_grants" ("id", "event_member_id", "event_id", "surfaces")
SELECT g."id", g."wedding_member_id", g."event_id", g."surfaces"
FROM "wedding_ceremony_grants" g
WHERE EXISTS (SELECT 1 FROM "event_members" em WHERE em."id" = g."wedding_member_id")
  AND EXISTS (SELECT 1 FROM "events" e WHERE e."id" = g."event_id");

ALTER TABLE "event_checklist_concealments" DROP CONSTRAINT "event_checklist_concealments_wedding_member_id_fkey";
DROP INDEX "event_checklist_concealments_checklist_id_wedding_member_id_key";
ALTER TABLE "event_checklist_concealments" RENAME COLUMN "wedding_member_id" TO "event_member_id";
DELETE FROM "event_checklist_concealments" c
WHERE NOT EXISTS (SELECT 1 FROM "event_members" em WHERE em."id" = c."event_member_id");
CREATE UNIQUE INDEX "event_checklist_concealments_checklist_id_event_member_id_key"
    ON "event_checklist_concealments"("checklist_id", "event_member_id");
ALTER TABLE "event_checklist_concealments"
    ADD CONSTRAINT "event_checklist_concealments_event_member_id_fkey"
    FOREIGN KEY ("event_member_id") REFERENCES "event_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events" DROP CONSTRAINT "events_wedding_id_fkey";
DROP INDEX "events_wedding_id_idx";
ALTER TABLE "events" DROP COLUMN "wedding_id";

DROP TABLE "wedding_ceremony_grants";
DROP TABLE "wedding_members";
DROP TABLE "weddings";

CREATE INDEX "events_parent_id_idx" ON "events"("parent_id");
CREATE UNIQUE INDEX "event_sub_grants_event_member_id_event_id_key" ON "event_sub_grants"("event_member_id", "event_id");
CREATE INDEX "event_sub_grants_event_id_idx" ON "event_sub_grants"("event_id");

ALTER TABLE "events"
    ADD CONSTRAINT "events_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_sub_grants"
    ADD CONSTRAINT "event_sub_grants_event_member_id_fkey"
    FOREIGN KEY ("event_member_id") REFERENCES "event_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_sub_grants"
    ADD CONSTRAINT "event_sub_grants_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

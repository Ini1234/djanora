-- Drop seeded personal items; lists are user-created from here.
DROP TABLE "user_checklist_items";

ALTER TABLE "users" DROP COLUMN IF EXISTS "personal_checklist_seeded_at";

CREATE TABLE "user_checklists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_checklists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_checklist_items" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "due_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_checklists_user_id_created_at_idx" ON "user_checklists"("user_id", "created_at");
CREATE INDEX "user_checklists_event_id_idx" ON "user_checklists"("event_id");
CREATE INDEX "user_checklist_items_checklist_id_sort_order_idx" ON "user_checklist_items"("checklist_id", "sort_order");

ALTER TABLE "user_checklists" ADD CONSTRAINT "user_checklists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_checklists" ADD CONSTRAINT "user_checklists_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_checklist_items" ADD CONSTRAINT "user_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "user_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Allow contacting a vendor before an event exists.
ALTER TABLE "inquiries" DROP CONSTRAINT "inquiries_event_id_fkey";
ALTER TABLE "inquiries" ALTER COLUMN "event_id" DROP NOT NULL;
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "inquiries_event_id_idx" ON "inquiries"("event_id");

-- CreateIndex
CREATE INDEX "inquiry_messages_sender_id_idx" ON "inquiry_messages"("sender_id");

-- AddForeignKey
ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "mcp_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "current_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_confirm_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "spent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_confirm_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mcp_sessions_user_id_last_used_at_idx" ON "mcp_sessions"("user_id", "last_used_at");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_confirm_tokens_token_hash_key" ON "mcp_confirm_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "mcp_confirm_tokens_session_id_tool_name_spent_at_idx" ON "mcp_confirm_tokens"("session_id", "tool_name", "spent_at");

-- AddForeignKey
ALTER TABLE "mcp_sessions" ADD CONSTRAINT "mcp_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_sessions" ADD CONSTRAINT "mcp_sessions_current_event_id_fkey" FOREIGN KEY ("current_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_confirm_tokens" ADD CONSTRAINT "mcp_confirm_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "mcp_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_confirm_tokens" ADD CONSTRAINT "mcp_confirm_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

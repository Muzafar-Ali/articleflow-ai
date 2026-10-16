-- CreateEnum
CREATE TYPE "AgentJobStatus" AS ENUM ('CREATED', 'QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'DISPATCHED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_updates" (
    "id" UUID NOT NULL,
    "telegram_update_id" BIGINT NOT NULL,
    "user_id" UUID NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_update_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "AgentJobStatus" NOT NULL DEFAULT 'CREATED',
    "request_json" JSONB NOT NULL,
    "approval_required" BOOLEAN NOT NULL DEFAULT false,
    "current_node" TEXT,
    "revision_count" INTEGER NOT NULL DEFAULT 0,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "agent_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_user_id_key" ON "users"("telegram_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_updates_telegram_update_id_key" ON "telegram_updates"("telegram_update_id");

-- CreateIndex
CREATE INDEX "telegram_updates_user_id_received_at_idx" ON "telegram_updates"("user_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_jobs_source_update_id_key" ON "agent_jobs"("source_update_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_jobs_idempotency_key_key" ON "agent_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "agent_jobs_status_created_at_idx" ON "agent_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "agent_jobs_user_id_created_at_idx" ON "agent_jobs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_next_attempt_at_idx" ON "outbox_events"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_id_idx" ON "outbox_events"("aggregate_id");

-- AddForeignKey
ALTER TABLE "telegram_updates" ADD CONSTRAINT "telegram_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_source_update_id_fkey" FOREIGN KEY ("source_update_id") REFERENCES "telegram_updates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

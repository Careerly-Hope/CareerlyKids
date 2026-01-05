-- Add deletedAt to User table
ALTER TABLE "users"
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Create webhook_events table
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventId" VARCHAR(255) NOT NULL,
    "eventType" VARCHAR(50) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- Enforce idempotency
CREATE UNIQUE INDEX "webhook_events_eventId_key"
ON "webhook_events"("eventId");

CREATE INDEX "webhook_events_eventType_idx"
ON "webhook_events"("eventType");

CREATE INDEX "webhook_events_processedAt_idx"
ON "webhook_events"("processedAt");

-- Create audit_logs table
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "metadata" JSONB,
    "ipAddress" VARCHAR(45),
    "requestId" VARCHAR(100),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_userId_idx"
ON "audit_logs"("userId");

CREATE INDEX "audit_logs_action_idx"
ON "audit_logs"("action");

CREATE INDEX "audit_logs_timestamp_idx"
ON "audit_logs"("timestamp");

CREATE INDEX "audit_logs_requestId_idx"
ON "audit_logs"("requestId");

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('INDIVIDUAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "access_tokens" (
    "id" UUID NOT NULL,
    "token" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "type" "TokenType" NOT NULL DEFAULT 'INDIVIDUAL',
    "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "usageCount" SMALLINT NOT NULL DEFAULT 0,
    "maxUsage" SMALLINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstUsedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paymentId" VARCHAR(100),
    "paymentStatus" "PaymentStatus",
    "amount" DECIMAL(10,2),
    "currency" VARCHAR(3) DEFAULT 'USD',
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_tokens_token_key" ON "access_tokens"("token");

-- CreateIndex
CREATE INDEX "access_tokens_token_idx" ON "access_tokens"("token");

-- CreateIndex
CREATE INDEX "access_tokens_email_idx" ON "access_tokens"("email");

-- CreateIndex
CREATE INDEX "access_tokens_status_idx" ON "access_tokens"("status");

-- CreateIndex
CREATE INDEX "access_tokens_type_idx" ON "access_tokens"("type");

-- CreateIndex
CREATE INDEX "access_tokens_expiresAt_idx" ON "access_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "access_tokens_createdAt_idx" ON "access_tokens"("createdAt");

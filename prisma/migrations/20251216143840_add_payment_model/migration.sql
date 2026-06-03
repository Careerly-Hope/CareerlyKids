-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(255) NOT NULL,
    "userId" UUID NOT NULL,
    "tokenId" UUID,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paystackReference" VARCHAR(255),
    "authorizationUrl" TEXT,
    "accessCode" VARCHAR(255),
    "metadata" JSONB NOT NULL,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paystackReference_key" ON "payments"("paystackReference");

-- CreateIndex
CREATE INDEX "payments_reference_idx" ON "payments"("reference");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_paystackReference_idx" ON "payments"("paystackReference");

-- CreateIndex
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

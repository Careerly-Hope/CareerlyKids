-- CreateTable
CREATE TABLE "token_usage" (
    "id" UUID NOT NULL,
    "tokenId" UUID NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "class" VARCHAR(50) NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "ipAddress" VARCHAR(45),

    CONSTRAINT "token_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_usage_tokenId_idx" ON "token_usage"("tokenId");

-- CreateIndex
CREATE INDEX "token_usage_sessionToken_idx" ON "token_usage"("sessionToken");

-- CreateIndex
CREATE INDEX "token_usage_unlockedAt_idx" ON "token_usage"("unlockedAt");

-- CreateIndex
CREATE INDEX "token_usage_class_idx" ON "token_usage"("class");

-- CreateIndex
CREATE UNIQUE INDEX "token_usage_tokenId_sessionToken_key" ON "token_usage"("tokenId", "sessionToken");

-- AddForeignKey
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "access_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_sessionToken_fkey" FOREIGN KEY ("sessionToken") REFERENCES "test_results"("sessionToken") ON DELETE CASCADE ON UPDATE CASCADE;

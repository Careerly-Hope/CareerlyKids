/*
  Warnings:

  - A unique constraint covering the columns `[sessionToken]` on the table `test_results` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sessionToken` to the `test_results` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('STARTED', 'COMPLETED', 'EXPIRED');

-- AlterTable
ALTER TABLE "test_results" ADD COLUMN     "jobPreferences" JSONB,
ADD COLUMN     "sessionToken" TEXT NOT NULL,
ADD COLUMN     "tier" VARCHAR(20),
ADD COLUMN     "totalScore" INTEGER,
ADD COLUMN     "aiRecommendation" JSONB;


-- CreateTable
CREATE TABLE "test_sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'STARTED',

    CONSTRAINT "test_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "test_sessions_sessionToken_key" ON "test_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "test_sessions_sessionToken_idx" ON "test_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "test_sessions_expiresAt_idx" ON "test_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "test_sessions_status_idx" ON "test_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "test_results_sessionToken_key" ON "test_results"("sessionToken");

-- CreateIndex
CREATE INDEX "test_results_sessionToken_idx" ON "test_results"("sessionToken");

-- CreateIndex
CREATE INDEX "test_results_tier_idx" ON "test_results"("tier");

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_sessionToken_fkey" FOREIGN KEY ("sessionToken") REFERENCES "test_sessions"("sessionToken") ON DELETE CASCADE ON UPDATE CASCADE;

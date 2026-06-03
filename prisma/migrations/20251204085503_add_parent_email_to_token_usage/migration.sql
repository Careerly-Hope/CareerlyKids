-- AlterTable
ALTER TABLE "token_usage" ADD COLUMN     "parentEmail" VARCHAR(255);

-- CreateIndex
CREATE INDEX "token_usage_parentEmail_idx" ON "token_usage"("parentEmail");

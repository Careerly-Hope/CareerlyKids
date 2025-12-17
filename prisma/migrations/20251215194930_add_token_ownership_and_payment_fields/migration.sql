/*
  Warnings:

  - You are about to drop the column `amount` on the `access_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `paymentId` on the `access_tokens` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "access_tokens" DROP COLUMN "amount",
DROP COLUMN "paymentId",
ADD COLUMN     "amountPaid" INTEGER,
ADD COLUMN     "createdBy" VARCHAR(100),
ADD COLUMN     "ownerId" UUID,
ADD COLUMN     "paymentIntentId" VARCHAR(255),
ALTER COLUMN "currency" SET DEFAULT 'NGN';

-- CreateIndex
CREATE INDEX "access_tokens_ownerId_idx" ON "access_tokens"("ownerId");

-- AddForeignKey
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "guestEmail" VARCHAR(255),
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "payments_guestEmail_idx" ON "payments"("guestEmail");

-- AlterTable
ALTER TABLE "test_results" ADD COLUMN     "feedbackRating" SMALLINT,
ADD COLUMN     "feedbackSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "userFeedback" TEXT;

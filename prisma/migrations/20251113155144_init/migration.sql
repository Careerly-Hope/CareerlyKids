-- CreateEnum
CREATE TYPE "RIASECCategory" AS ENUM ('R', 'I', 'A', 'S', 'E', 'C');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('BEST_FIT', 'GREAT_FIT', 'GOOD_FIT');

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "category" "RIASECCategory" NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_results" (
    "id" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responses" JSONB NOT NULL,
    "scores" JSONB NOT NULL,
    "careerCode" VARCHAR(3) NOT NULL,
    "matchedCareers" JSONB NOT NULL,
    "completionTime" INTEGER,
    "deviceType" VARCHAR(50),

    CONSTRAINT "test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_profiles" (
    "id" SERIAL NOT NULL,
    "careerName" VARCHAR(200) NOT NULL,
    "profile" JSONB NOT NULL,
    "jobZone" SMALLINT NOT NULL,
    "jobTier" SMALLINT NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "onetCode" VARCHAR(20),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_category_idx" ON "questions"("category");

-- CreateIndex
CREATE INDEX "questions_isActive_idx" ON "questions"("isActive");

-- CreateIndex
CREATE INDEX "test_results_timestamp_idx" ON "test_results"("timestamp");

-- CreateIndex
CREATE INDEX "test_results_careerCode_idx" ON "test_results"("careerCode");

-- CreateIndex
CREATE UNIQUE INDEX "career_profiles_careerName_key" ON "career_profiles"("careerName");

-- CreateIndex
CREATE INDEX "career_profiles_jobZone_idx" ON "career_profiles"("jobZone");

-- CreateIndex
CREATE INDEX "career_profiles_jobTier_idx" ON "career_profiles"("jobTier");

-- CreateIndex
CREATE INDEX "career_profiles_isActive_idx" ON "career_profiles"("isActive");

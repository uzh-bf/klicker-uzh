-- CreateTable
CREATE TABLE "AnalyticsEligibilityGeneration" (
    "id" INTEGER NOT NULL,
    "generation" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "AnalyticsEligibilityGeneration_pkey" PRIMARY KEY ("id")
);

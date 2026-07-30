CREATE TABLE "LearningAnalyticsCleanupReceipt" (
    "id" TEXT NOT NULL,
    "contractHash" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningAnalyticsCleanupReceipt_pkey" PRIMARY KEY ("id")
);

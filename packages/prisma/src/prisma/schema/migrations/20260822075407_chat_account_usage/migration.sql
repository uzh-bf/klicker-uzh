-- CreateEnum
CREATE TYPE "ChatUsageClass" AS ENUM ('BASE', 'ADVANCED');

-- CreateTable
CREATE TABLE "ChatAccountUsage" (
    "monthStart" DATE NOT NULL,
    "budgetCredits" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "usedCredits" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ownerId" UUID NOT NULL,
    "usageClass" "ChatUsageClass" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatAccountUsage_pkey" PRIMARY KEY ("ownerId","usageClass","monthStart")
);

-- AddForeignKey
ALTER TABLE "ChatAccountUsage" ADD CONSTRAINT "ChatAccountUsage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

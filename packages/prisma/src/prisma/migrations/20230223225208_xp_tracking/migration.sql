-- AlterTable
ALTER TABLE "QuestionResponse" ADD COLUMN     "lastXpAwardedAt" TIMESTAMP(3),
ADD COLUMN     "totalXpAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "QuestionResponseDetail" ADD COLUMN     "xpAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0;

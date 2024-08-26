-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "magicLinkExpiresAt" TIMESTAMP(3),
ADD COLUMN     "magicLinkToken" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "loginToken" TEXT,
ADD COLUMN     "loginTokenExpiresAt" TIMESTAMP(3);

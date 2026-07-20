-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "isGamificationEnabled" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "pinCode" DROP DEFAULT;

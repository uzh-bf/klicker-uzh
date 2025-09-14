-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'de');

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "locale" "Locale" NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" "Locale" NOT NULL DEFAULT 'en';

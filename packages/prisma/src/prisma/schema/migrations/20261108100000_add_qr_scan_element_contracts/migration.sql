-- AlterEnum
ALTER TYPE "public"."ElementType" ADD VALUE 'QR_SCAN';

-- AlterTable
ALTER TABLE "public"."Element" ADD COLUMN     "qrScanCode" TEXT;

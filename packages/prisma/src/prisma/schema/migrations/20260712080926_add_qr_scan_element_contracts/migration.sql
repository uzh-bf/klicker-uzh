/*
  Warnings:

  - A unique constraint covering the columns `[qrScanCode]` on the table `Element` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "public"."ElementType" ADD VALUE 'QR_SCAN';

-- AlterTable
ALTER TABLE "public"."Element" ADD COLUMN     "qrScanCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Element_qrScanCode_key" ON "public"."Element"("qrScanCode");

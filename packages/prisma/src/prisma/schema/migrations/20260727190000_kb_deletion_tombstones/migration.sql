-- CreateEnum
CREATE TYPE "public"."KBIngestionOperation" AS ENUM ('UPSERT', 'DELETE');

-- AlterTable
ALTER TABLE "public"."KB"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" UUID;

-- AlterTable
ALTER TABLE "public"."KBResource"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" UUID,
ADD COLUMN "ingestionOperation" "public"."KBIngestionOperation" NOT NULL DEFAULT 'UPSERT';

-- AlterTable
ALTER TABLE "public"."KBIngestionRun"
ADD COLUMN "operation" "public"."KBIngestionOperation" NOT NULL DEFAULT 'UPSERT';

-- CreateTable
CREATE TABLE "public"."KBUploadTicket" (
    "id" UUID NOT NULL,
    "blobName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "kbId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KBUploadTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KB_deletedAt_idx" ON "public"."KB"("deletedAt");

-- CreateIndex
CREATE INDEX "KBResource_deletedAt_idx" ON "public"."KBResource"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KBUploadTicket_kbId_blobName_key" ON "public"."KBUploadTicket"("kbId", "blobName");

-- CreateIndex
CREATE INDEX "KBUploadTicket_expiresAt_idx" ON "public"."KBUploadTicket"("expiresAt");

-- AddForeignKey
ALTER TABLE "public"."KB"
ADD CONSTRAINT "KB_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBResource"
ADD CONSTRAINT "KBResource_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBUploadTicket"
ADD CONSTRAINT "KBUploadTicket_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "public"."KB"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

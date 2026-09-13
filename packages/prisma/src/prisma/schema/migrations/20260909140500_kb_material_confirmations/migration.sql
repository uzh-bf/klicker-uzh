-- AlterTable
ALTER TABLE "KBResource" ADD COLUMN     "materialConfirmationId" UUID;

-- AlterTable
ALTER TABLE "KBUploadTicket" ADD COLUMN     "materialConfirmationId" UUID;

-- AlterTable
ALTER TABLE "KBChatbot" ADD COLUMN     "materialConfirmationId" UUID;

-- CreateTable
CREATE TABLE "KBMaterialConfirmation" (
    "id" UUID NOT NULL,
    "kbId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "rightsConfirmed" BOOLEAN NOT NULL,
    "personalDataConfirmed" BOOLEAN NOT NULL,
    "purpose" TEXT NOT NULL,
    "scopeFingerprint" TEXT NOT NULL,
    "scopeSnapshot" TEXT NOT NULL,
    "resourceId" UUID,
    "resourceVersion" INTEGER,
    "sourceKey" TEXT,
    "chatbotId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KBMaterialConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KBMaterialConfirmation_kbId_createdAt_idx" ON "KBMaterialConfirmation"("kbId", "createdAt");

-- AddForeignKey
ALTER TABLE "KBMaterialConfirmation" ADD CONSTRAINT "KBMaterialConfirmation_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

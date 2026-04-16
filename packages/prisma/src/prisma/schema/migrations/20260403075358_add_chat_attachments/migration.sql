-- CreateEnum
CREATE TYPE "public"."ChatAttachmentType" AS ENUM ('IMAGE');

-- CreateTable
CREATE TABLE "public"."ChatAttachment" (
    "id" UUID NOT NULL,
    "type" "public"."ChatAttachmentType" NOT NULL,
    "imageBase64" TEXT,
    "imageDescription" TEXT,
    "messageId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatAttachment_messageId_idx" ON "public"."ChatAttachment"("messageId");

-- AddForeignKey
ALTER TABLE "public"."ChatAttachment" ADD CONSTRAINT "ChatAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

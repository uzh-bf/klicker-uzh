-- AlterTable
ALTER TABLE "public"."ChatMessage" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "ChatMessage_parentId_idx" ON "public"."ChatMessage"("parentId");

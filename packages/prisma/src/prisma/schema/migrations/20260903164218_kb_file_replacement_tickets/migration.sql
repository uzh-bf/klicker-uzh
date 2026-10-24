-- AlterTable
ALTER TABLE "KBUploadTicket" ADD COLUMN     "expectedResourceVersion" INTEGER,
ADD COLUMN     "replacementResourceId" UUID;

-- CreateIndex
CREATE INDEX "KBUploadTicket_replacementResourceId_idx" ON "KBUploadTicket"("replacementResourceId");

-- AddForeignKey
ALTER TABLE "KBUploadTicket" ADD CONSTRAINT "KBUploadTicket_replacementResourceId_fkey" FOREIGN KEY ("replacementResourceId") REFERENCES "KBResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

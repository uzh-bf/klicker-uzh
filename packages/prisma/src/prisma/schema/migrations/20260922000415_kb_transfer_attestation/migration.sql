-- AlterTable
ALTER TABLE "KBResource" ADD COLUMN     "personalDataConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "rightsConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "transferAttestationVersion" TEXT;

-- AlterTable
ALTER TABLE "KBUploadTicket" ADD COLUMN     "personalDataConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "rightsConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "transferAttestationVersion" TEXT;


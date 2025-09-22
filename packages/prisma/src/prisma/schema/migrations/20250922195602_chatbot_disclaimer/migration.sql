-- AlterTable
ALTER TABLE "public"."ChatUsageCredits" ADD COLUMN     "acceptedDisclaimerId" UUID,
ADD COLUMN     "disclaimerAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "disclaimerDeclined" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Chatbot" ADD COLUMN     "disclaimerId" UUID;

-- CreateTable
CREATE TABLE "public"."ChatbotDisclaimer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "title" TEXT NOT NULL,
    "introText" TEXT,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotDisclaimer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Chatbot" ADD CONSTRAINT "Chatbot_disclaimerId_fkey" FOREIGN KEY ("disclaimerId") REFERENCES "public"."ChatbotDisclaimer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatbotDisclaimer" ADD CONSTRAINT "ChatbotDisclaimer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

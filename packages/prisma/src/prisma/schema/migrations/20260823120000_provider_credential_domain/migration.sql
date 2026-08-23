-- CreateEnum
CREATE TYPE "public"."ProviderCredentialStatus" AS ENUM ('PENDING_VALIDATION', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'DELETION_PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."ProviderNoticeAcknowledgementSource" AS ENUM ('CHAT_FIRST_USE');

-- CreateTable
CREATE TABLE "public"."ProviderProfile" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "providerKind" TEXT NOT NULL,
    "endpointAlias" TEXT NOT NULL,
    "deploymentAliases" TEXT[],
    "autoManifestVersion" TEXT,
    "pricingSource" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "dataBoundary" JSONB,
    "noticeVersion" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProviderCredential" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "vaultSecretName" TEXT NOT NULL,
    "vaultSecretVersion" INTEGER NOT NULL,
    "safeFingerprint" TEXT,
    "status" "public"."ProviderCredentialStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "validatedModelAlias" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatbotProviderBinding" (
    "id" UUID NOT NULL,
    "credentialId" UUID NOT NULL,
    "chatbotId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "allowedModelAlias" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "participantQuotaLimit" DECIMAL(18,6) NOT NULL,
    "aggregateQuotaLimit" DECIMAL(18,6) NOT NULL,
    "currentNoticeVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotProviderBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProviderNoticeAcknowledgement" (
    "id" UUID NOT NULL,
    "bindingId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "noticeVersion" INTEGER NOT NULL,
    "source" "public"."ProviderNoticeAcknowledgementSource" NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderNoticeAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ByokUsageAccount" (
    "id" UUID NOT NULL,
    "credentialId" UUID NOT NULL,
    "bindingId" UUID,
    "participantId" UUID,
    "reservedAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "usedAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "requestTraceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ByokUsageAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TraceDeletionJob" (
    "id" UUID NOT NULL,
    "bindingId" UUID,
    "tombstonedUserId" UUID,
    "tombstonedChatbotId" UUID,
    "traceSelectors" JSONB NOT NULL,
    "requestedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "terminalState" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraceDeletionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_key_key" ON "public"."ProviderProfile"("key");

-- CreateIndex
CREATE INDEX "ProviderProfile_isActive_idx" ON "public"."ProviderProfile"("isActive");

-- CreateIndex
CREATE INDEX "ProviderCredential_ownerId_idx" ON "public"."ProviderCredential"("ownerId");

-- CreateIndex
CREATE INDEX "ProviderCredential_profileId_status_idx" ON "public"."ProviderCredential"("profileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChatbotProviderBinding_chatbotId_credentialId_key" ON "public"."ChatbotProviderBinding"("chatbotId", "credentialId");

-- CreateIndex
CREATE INDEX "ChatbotProviderBinding_chatbotId_isActive_idx" ON "public"."ChatbotProviderBinding"("chatbotId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderNoticeAcknowledgement_participantId_bindingId_noticeVersion_key" ON "public"."ProviderNoticeAcknowledgement"("participantId", "bindingId", "noticeVersion");

-- CreateIndex
CREATE INDEX "ByokUsageAccount_credentialId_isSettled_idx" ON "public"."ByokUsageAccount"("credentialId", "isSettled");

-- CreateIndex
CREATE INDEX "ByokUsageAccount_participantId_idx" ON "public"."ByokUsageAccount"("participantId");

-- CreateIndex
CREATE INDEX "TraceDeletionJob_terminalState_idx" ON "public"."TraceDeletionJob"("terminalState");

-- AddForeignKey
ALTER TABLE "public"."ProviderCredential" ADD CONSTRAINT "ProviderCredential_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProviderCredential" ADD CONSTRAINT "ProviderCredential_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatbotProviderBinding" ADD CONSTRAINT "ChatbotProviderBinding_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "public"."ProviderCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatbotProviderBinding" ADD CONSTRAINT "ChatbotProviderBinding_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatbotProviderBinding" ADD CONSTRAINT "ChatbotProviderBinding_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProviderNoticeAcknowledgement" ADD CONSTRAINT "ProviderNoticeAcknowledgement_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "public"."ChatbotProviderBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProviderNoticeAcknowledgement" ADD CONSTRAINT "ProviderNoticeAcknowledgement_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ByokUsageAccount" ADD CONSTRAINT "ByokUsageAccount_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "public"."ProviderCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ByokUsageAccount" ADD CONSTRAINT "ByokUsageAccount_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "public"."ChatbotProviderBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ByokUsageAccount" ADD CONSTRAINT "ByokUsageAccount_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TraceDeletionJob" ADD CONSTRAINT "TraceDeletionJob_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "public"."ChatbotProviderBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

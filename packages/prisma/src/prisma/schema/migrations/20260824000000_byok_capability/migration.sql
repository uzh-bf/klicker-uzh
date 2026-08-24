-- CreateEnum
CREATE TYPE "ByokCapabilityStatus" AS ENUM ('RESERVED', 'ISSUED', 'CONSUMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ByokCapability" (
    "id" UUID NOT NULL,
    "status" "ByokCapabilityStatus" NOT NULL DEFAULT 'RESERVED',
    "ownerId" UUID NOT NULL,
    "chatbotId" UUID NOT NULL,
    "profileKey" TEXT NOT NULL,
    "allowedModelAlias" TEXT NOT NULL,
    "vaultSecretVersion" INTEGER NOT NULL,
    "bearerHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "credentialId" UUID NOT NULL,
    "bindingId" UUID NOT NULL,
    "usageAccountId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ByokCapability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ByokCapability_bearerHash_key" ON "ByokCapability"("bearerHash");
CREATE INDEX "ByokCapability_status_expiresAt_idx" ON "ByokCapability"("status", "expiresAt");
CREATE INDEX "ByokCapability_ownerId_idx" ON "ByokCapability"("ownerId");

-- AddForeignKey
ALTER TABLE "ByokCapability" ADD CONSTRAINT "ByokCapability_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ProviderCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ByokCapability" ADD CONSTRAINT "ByokCapability_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "ChatbotProviderBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ByokCapability" ADD CONSTRAINT "ByokCapability_usageAccountId_fkey" FOREIGN KEY ("usageAccountId") REFERENCES "ByokUsageAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "public"."ProviderCredentialOutbox" (
    "id" UUID NOT NULL,
    "credentialId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "terminalState" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCredentialOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderCredentialOutbox_credentialId_terminalState_idx" ON "public"."ProviderCredentialOutbox"("credentialId", "terminalState");

-- CreateIndex
CREATE INDEX "ProviderCredentialOutbox_terminalState_idx" ON "public"."ProviderCredentialOutbox"("terminalState");

-- AddForeignKey
ALTER TABLE "public"."ProviderCredentialOutbox" ADD CONSTRAINT "ProviderCredentialOutbox_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "public"."ProviderCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

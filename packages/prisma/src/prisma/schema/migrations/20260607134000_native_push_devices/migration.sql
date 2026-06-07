-- CreateEnum
CREATE TYPE "PushDevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "PushDeviceProvider" AS ENUM ('FCM', 'WEB_PUSH');

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" UUID NOT NULL,
    "platform" "PushDevicePlatform" NOT NULL,
    "provider" "PushDeviceProvider" NOT NULL DEFAULT 'FCM',
    "token" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "appId" TEXT,
    "appVersion" TEXT,
    "deviceId" TEXT,
    "locale" "Locale",
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "participantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_tokenHash_key" ON "PushDevice"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_participantId_provider_deviceId_key" ON "PushDevice"("participantId", "provider", "deviceId");

-- CreateIndex
CREATE INDEX "PushDevice_participantId_enabled_idx" ON "PushDevice"("participantId", "enabled");

-- CreateIndex
CREATE INDEX "PushDevice_provider_platform_enabled_idx" ON "PushDevice"("provider", "platform", "enabled");

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

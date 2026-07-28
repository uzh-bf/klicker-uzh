-- CreateEnum
CREATE TYPE "public"."KBResourceType" AS ENUM ('BLOB', 'URL');

-- CreateEnum
CREATE TYPE "public"."KBResourceStatus" AS ENUM ('ADDED', 'QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "public"."KB" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KB_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KBResource" (
    "id" UUID NOT NULL,
    "type" "public"."KBResourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "blobName" TEXT,
    "blobHref" TEXT,
    "status" "public"."KBResourceStatus" NOT NULL DEFAULT 'ADDED',
    "statusMessage" TEXT,
    "ingestedAt" TIMESTAMP(3),
    "kbId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KB_ownerId_idx" ON "public"."KB"("ownerId");

-- CreateIndex
CREATE INDEX "KBResource_kbId_status_idx" ON "public"."KBResource"("kbId", "status");

-- AddForeignKey
ALTER TABLE "public"."KB" ADD CONSTRAINT "KB_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBResource" ADD CONSTRAINT "KBResource_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "public"."KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

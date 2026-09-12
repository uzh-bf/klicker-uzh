-- CreateEnum
CREATE TYPE "KBImportedSourceKind" AS ENUM ('DOCUMENT', 'LINK', 'VIDEO', 'IMAGE');

-- CreateEnum
CREATE TYPE "KBImportedSourceIdentityField" AS ENUM ('SOURCE_ID', 'VIDEO_SOURCE_ID');

-- CreateTable
CREATE TABLE "KBImportedSource" (
    "id" UUID NOT NULL,
    "databaseName" TEXT NOT NULL,
    "collectionName" TEXT NOT NULL,
    "sourceIdentityField" "KBImportedSourceIdentityField" NOT NULL,
    "sourceIdentityValue" TEXT NOT NULL,
    "projectId" TEXT,
    "producerId" TEXT,
    "title" TEXT NOT NULL,
    "kind" "KBImportedSourceKind" NOT NULL,
    "sourceUrl" TEXT,
    "ingestedAt" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL,
    "identitySha256" TEXT NOT NULL,
    "metadataSha256" TEXT NOT NULL,
    "kbId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KBImportedSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KBImportedSource_kbId_idx" ON "KBImportedSource"("kbId");

-- CreateIndex
CREATE UNIQUE INDEX "KBImportedSource_kbId_identitySha256_key" ON "KBImportedSource"("kbId", "identitySha256");

-- AddForeignKey
ALTER TABLE "KBImportedSource" ADD CONSTRAINT "KBImportedSource_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "KB"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

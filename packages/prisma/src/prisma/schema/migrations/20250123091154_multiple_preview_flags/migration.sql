-- AlterTable
ALTER TABLE "User" RENAME COLUMN "featurePreview" TO "publicPreview";
ALTER TABLE "User" ADD COLUMN "privatePreview" BOOLEAN NOT NULL DEFAULT false;

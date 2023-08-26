-- AlterTable
ALTER TABLE "User" ADD COLUMN     "catalystIndividual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalystInstitutional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalystTier" TEXT;

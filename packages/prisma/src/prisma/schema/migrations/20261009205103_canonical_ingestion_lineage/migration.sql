-- AlterTable
ALTER TABLE "KBGraphBuild" ADD COLUMN     "sourceInputContract" TEXT,
ADD COLUMN     "sourceInputDigest" TEXT;

-- AlterTable
ALTER TABLE "KBGraphBuildSource" ADD COLUMN     "canonicalInput" JSONB;

-- AlterTable
ALTER TABLE "KBResource" ADD COLUMN     "activeCanonicalInput" JSONB,
ADD COLUMN     "inputContract" TEXT;

-- CreateEnum
CREATE TYPE "PeerInstructionPhase" AS ENUM ('INACTIVE', 'AVAILABLE', 'DISCUSSION', 'REVISION_OPEN', 'REVISION_FINALIZING', 'COMPARISON_READY', 'REVEALED', 'CANCELLED', 'REPLACEMENT_AVAILABLE', 'ABANDONED');

-- AlterTable
ALTER TABLE "ElementBlock" ADD COLUMN     "isPeerInstructionEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "peerInstructionPhase" "PeerInstructionPhase" NOT NULL DEFAULT 'INACTIVE',
ADD COLUMN     "peerInstructionRun" JSONB;

-- AlterTable
ALTER TABLE "ElementInstance" ADD COLUMN     "peerInstructionComparison" JSONB;

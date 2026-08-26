-- CreateEnum
CREATE TYPE "ChatMessageLifecycleStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "lifecycleAttemptId" UUID,
ADD COLUMN     "lifecycleStatus" "ChatMessageLifecycleStatus" NOT NULL DEFAULT 'COMPLETED';

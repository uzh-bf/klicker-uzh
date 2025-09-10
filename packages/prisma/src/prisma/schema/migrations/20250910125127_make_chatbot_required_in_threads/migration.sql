/*
  Warnings:

  - The primary key for the `ChatMessage` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `created_at` on the `ChatMessage` table. All the data in the column will be lost.
  - You are about to drop the column `thread_id` on the `ChatMessage` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `ChatMessage` table. All the data in the column will be lost.
  - The `parentId` column on the `ChatMessage` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `ChatThread` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `created_at` on the `ChatThread` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `ChatThread` table. All the data in the column will be lost.
  - Added the required column `threadId` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `ChatMessage` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `chatbotId` to the `ChatThread` table without a default value. This is not possible if the table is not empty.
  - Added the required column `participantId` to the `ChatThread` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ChatThread` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `ChatThread` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."ChatMessage" DROP CONSTRAINT "ChatMessage_thread_id_fkey";

-- AlterTable
ALTER TABLE "public"."ChatMessage" DROP CONSTRAINT "ChatMessage_pkey",
DROP COLUMN "created_at",
DROP COLUMN "thread_id",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "threadId" UUID NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "parentId",
ADD COLUMN     "parentId" UUID,
ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."ChatThread" DROP CONSTRAINT "ChatThread_pkey",
DROP COLUMN "created_at",
DROP COLUMN "updated_at",
ADD COLUMN     "chatbotId" UUID NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "participantId" UUID NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "public"."ChatUsageCredits" (
    "id" UUID NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "current" INTEGER NOT NULL DEFAULT 0,
    "participantId" UUID NOT NULL,
    "chatbotId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatUsageCredits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Chatbot" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatar" TEXT,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chatbot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatUsageCredits_participantId_chatbotId_key" ON "public"."ChatUsageCredits"("participantId", "chatbotId");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_idx" ON "public"."ChatMessage"("threadId");

-- CreateIndex
CREATE INDEX "ChatMessage_parentId_idx" ON "public"."ChatMessage"("parentId");

-- AddForeignKey
ALTER TABLE "public"."ChatUsageCredits" ADD CONSTRAINT "ChatUsageCredits_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatUsageCredits" ADD CONSTRAINT "ChatUsageCredits_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatThread" ADD CONSTRAINT "ChatThread_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatThread" ADD CONSTRAINT "ChatThread_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Chatbot" ADD CONSTRAINT "Chatbot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

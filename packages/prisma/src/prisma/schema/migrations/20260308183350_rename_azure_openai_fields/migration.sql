/*
  Warnings:

  - You are about to drop the column `azureOpenAIEndpoint` on the `Chatbot` table. All the data in the column will be lost.
  - You are about to drop the column `azureOpenAIKey` on the `Chatbot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Chatbot" DROP COLUMN "azureOpenAIEndpoint",
DROP COLUMN "azureOpenAIKey",
ADD COLUMN     "openaiApiKey" TEXT,
ADD COLUMN     "openaiBaseUrl" TEXT;

-- AlterTable
ALTER TABLE "public"."Chatbot" ADD COLUMN "allowedModelIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateEnum
CREATE TYPE "public"."ChatMessageRating" AS ENUM ('UP', 'DOWN');

-- AlterTable
ALTER TABLE "public"."ChatMessage" ADD COLUMN     "rating" "public"."ChatMessageRating";

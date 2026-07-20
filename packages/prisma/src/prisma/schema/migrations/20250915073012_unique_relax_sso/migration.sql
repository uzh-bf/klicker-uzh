/*
  Warnings:

  - A unique constraint covering the columns `[email,isSSOAccount]` on the table `Participant` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Participant_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "Participant_email_isSSOAccount_key" ON "public"."Participant"("email", "isSSOAccount");

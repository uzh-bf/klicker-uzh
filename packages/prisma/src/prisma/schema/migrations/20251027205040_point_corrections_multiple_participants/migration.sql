-- AlterEnum
ALTER TYPE "public"."PointCorrectionType" ADD VALUE 'MULTIPLE';

-- CreateTable
CREATE TABLE "public"."_PointCorrectionParticipants" (
    "A" UUID NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PointCorrectionParticipants_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_PointCorrectionParticipants_B_index" ON "public"."_PointCorrectionParticipants"("B");

-- AddForeignKey
ALTER TABLE "public"."_PointCorrectionParticipants" ADD CONSTRAINT "_PointCorrectionParticipants_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PointCorrectionParticipants" ADD CONSTRAINT "_PointCorrectionParticipants_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."PointCorrection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

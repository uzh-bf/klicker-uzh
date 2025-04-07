/*
  Warnings:

  - You are about to drop the column `objectOwnerId` on the `Permission` table. All the data in the column will be lost.
  - You are about to drop the column `permissionStatus` on the `Permission` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Permission" DROP CONSTRAINT "Permission_objectOwnerId_fkey";

-- AlterTable
ALTER TABLE "Permission" DROP COLUMN "objectOwnerId",
DROP COLUMN "permissionStatus",
ADD COLUMN     "propagation" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "PermissionStatus";

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" SERIAL NOT NULL,
    "permissionLevel" "PermissionLevel" NOT NULL,
    "userId" UUID NOT NULL,
    "objectAdminOrOwnerId" UUID NOT NULL,
    "catalogCollectionId" UUID,
    "answerCollectionId" INTEGER,
    "elementId" INTEGER,
    "courseId" UUID,
    "liveQuizId" UUID,
    "practiceQuizId" UUID,
    "microLearningId" UUID,
    "groupActivityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ObjectRequired" CHECK (("answerCollectionId" IS NOT NULL) OR ("elementId" IS NOT NULL) OR ("courseId" IS NOT NULL) OR ("liveQuizId" IS NOT NULL) OR ("practiceQuizId" IS NOT NULL) OR ("microLearningId" IS NOT NULL) OR ("groupActivityId" IS NOT NULL) OR("catalogCollectionId" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "DerivedPermission" (
    "id" SERIAL NOT NULL,
    "permissionLevel" "PermissionLevel" NOT NULL,
    "directPermissionId" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "catalogCollectionId" UUID,
    "answerCollectionId" INTEGER,
    "elementId" INTEGER,
    "courseId" UUID,
    "liveQuizId" UUID,
    "practiceQuizId" UUID,
    "microLearningId" UUID,
    "groupActivityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DerivedPermission_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ObjectRequired" CHECK (("answerCollectionId" IS NOT NULL) OR ("elementId" IS NOT NULL) OR ("courseId" IS NOT NULL) OR ("liveQuizId" IS NOT NULL) OR ("practiceQuizId" IS NOT NULL) OR ("microLearningId" IS NOT NULL) OR ("groupActivityId" IS NOT NULL) OR("catalogCollectionId" IS NOT NULL))
);

-- CreateIndex
CREATE INDEX "AccessRequest_userId_idx" ON "AccessRequest"("userId");

-- CreateIndex
CREATE INDEX "AccessRequest_objectAdminOrOwnerId_idx" ON "AccessRequest"("objectAdminOrOwnerId");

-- CreateIndex
CREATE INDEX "AccessRequest_catalogCollectionId_userId_idx" ON "AccessRequest"("catalogCollectionId", "userId");

-- CreateIndex
CREATE INDEX "AccessRequest_answerCollectionId_userId_idx" ON "AccessRequest"("answerCollectionId", "userId");

-- CreateIndex
CREATE INDEX "AccessRequest_elementId_userId_idx" ON "AccessRequest"("elementId", "userId");

-- CreateIndex
CREATE INDEX "AccessRequest_courseId_userId_idx" ON "AccessRequest"("courseId", "userId");

-- CreateIndex
CREATE INDEX "AccessRequest_liveQuizId_userId_idx" ON "AccessRequest"("liveQuizId", "userId");

-- CreateIndex
CREATE INDEX "AccessRequest_practiceQuizId_userId_idx" ON "AccessRequest"("practiceQuizId", "userId");

-- CreateIndex
CREATE INDEX "AccessRequest_microLearningId_userId_idx" ON "AccessRequest"("microLearningId", "userId");

-- CreateIndex
CREATE INDEX "AccessRequest_groupActivityId_userId_idx" ON "AccessRequest"("groupActivityId", "userId");

-- CreateIndex
CREATE INDEX "AccessRequest_catalogCollectionId_objectAdminOrOwnerId_idx" ON "AccessRequest"("catalogCollectionId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE INDEX "AccessRequest_answerCollectionId_objectAdminOrOwnerId_idx" ON "AccessRequest"("answerCollectionId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE INDEX "AccessRequest_elementId_objectAdminOrOwnerId_idx" ON "AccessRequest"("elementId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE INDEX "AccessRequest_courseId_objectAdminOrOwnerId_idx" ON "AccessRequest"("courseId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE INDEX "AccessRequest_liveQuizId_objectAdminOrOwnerId_idx" ON "AccessRequest"("liveQuizId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE INDEX "AccessRequest_practiceQuizId_objectAdminOrOwnerId_idx" ON "AccessRequest"("practiceQuizId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE INDEX "AccessRequest_microLearningId_objectAdminOrOwnerId_idx" ON "AccessRequest"("microLearningId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE INDEX "AccessRequest_groupActivityId_objectAdminOrOwnerId_idx" ON "AccessRequest"("groupActivityId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_catalogCollectionId_userId_objectAdminOrOwner_key" ON "AccessRequest"("catalogCollectionId", "userId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_answerCollectionId_userId_objectAdminOrOwnerI_key" ON "AccessRequest"("answerCollectionId", "userId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_elementId_userId_objectAdminOrOwnerId_key" ON "AccessRequest"("elementId", "userId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_courseId_userId_objectAdminOrOwnerId_key" ON "AccessRequest"("courseId", "userId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_liveQuizId_userId_objectAdminOrOwnerId_key" ON "AccessRequest"("liveQuizId", "userId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_practiceQuizId_userId_objectAdminOrOwnerId_key" ON "AccessRequest"("practiceQuizId", "userId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_microLearningId_userId_objectAdminOrOwnerId_key" ON "AccessRequest"("microLearningId", "userId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_groupActivityId_userId_objectAdminOrOwnerId_key" ON "AccessRequest"("groupActivityId", "userId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedPermission_catalogCollectionId_userId_key" ON "DerivedPermission"("catalogCollectionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedPermission_answerCollectionId_userId_key" ON "DerivedPermission"("answerCollectionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedPermission_elementId_userId_key" ON "DerivedPermission"("elementId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedPermission_courseId_userId_key" ON "DerivedPermission"("courseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedPermission_liveQuizId_userId_key" ON "DerivedPermission"("liveQuizId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedPermission_practiceQuizId_userId_key" ON "DerivedPermission"("practiceQuizId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedPermission_microLearningId_userId_key" ON "DerivedPermission"("microLearningId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedPermission_groupActivityId_userId_key" ON "DerivedPermission"("groupActivityId", "userId");

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_objectAdminOrOwnerId_fkey" FOREIGN KEY ("objectAdminOrOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_catalogCollectionId_fkey" FOREIGN KEY ("catalogCollectionId") REFERENCES "CatalogCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_answerCollectionId_fkey" FOREIGN KEY ("answerCollectionId") REFERENCES "AnswerCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedPermission" ADD CONSTRAINT "DerivedPermission_directPermissionId_fkey" FOREIGN KEY ("directPermissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedPermission" ADD CONSTRAINT "DerivedPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedPermission" ADD CONSTRAINT "DerivedPermission_catalogCollectionId_fkey" FOREIGN KEY ("catalogCollectionId") REFERENCES "CatalogCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedPermission" ADD CONSTRAINT "DerivedPermission_answerCollectionId_fkey" FOREIGN KEY ("answerCollectionId") REFERENCES "AnswerCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedPermission" ADD CONSTRAINT "DerivedPermission_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedPermission" ADD CONSTRAINT "DerivedPermission_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedPermission" ADD CONSTRAINT "DerivedPermission_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedPermission" ADD CONSTRAINT "DerivedPermission_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedPermission" ADD CONSTRAINT "DerivedPermission_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedPermission" ADD CONSTRAINT "DerivedPermission_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the `_AnswerCollectionAccessRequested` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_AnswerCollectionShared` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('READ', 'WRITE');

-- CreateEnum
CREATE TYPE "PermissionStatus" AS ENUM ('REQUESTED', 'GRANTED');

-- DropForeignKey
ALTER TABLE "_AnswerCollectionAccessRequested" DROP CONSTRAINT "_AnswerCollectionAccessRequested_A_fkey";

-- DropForeignKey
ALTER TABLE "_AnswerCollectionAccessRequested" DROP CONSTRAINT "_AnswerCollectionAccessRequested_B_fkey";

-- DropForeignKey
ALTER TABLE "_AnswerCollectionShared" DROP CONSTRAINT "_AnswerCollectionShared_A_fkey";

-- DropForeignKey
ALTER TABLE "_AnswerCollectionShared" DROP CONSTRAINT "_AnswerCollectionShared_B_fkey";

-- DropTable
DROP TABLE "_AnswerCollectionAccessRequested";

-- DropTable
DROP TABLE "_AnswerCollectionShared";

-- CreateTable
CREATE TABLE "UserGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL,
    "permissionStatus" "PermissionStatus" NOT NULL,
    "userId" UUID,
    "userGroupId" INTEGER,
    "objectOwnerId" UUID,
    "answerCollectionId" INTEGER,
    "elementId" INTEGER,
    "courseId" UUID,
    "liveQuizId" UUID,
    "practiceQuizId" UUID,
    "microLearningId" UUID,
    "groupActivityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserOrGroupRequired" CHECK ((("userId" IS NOT NULL) AND ("userGroupId" IS NULL)) OR (("userId" IS NULL) AND ("userGroupId" IS NOT NULL))),
    CONSTRAINT "ObjectRequired" CHECK (("answerCollectionId" IS NOT NULL) OR ("elementId" IS NOT NULL) OR ("courseId" IS NOT NULL) OR ("liveQuizId" IS NOT NULL) OR ("practiceQuizId" IS NOT NULL) OR ("microLearningId" IS NOT NULL) OR ("groupActivityId" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "_UserGroupMembers" (
    "A" UUID NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_UserGroupMembers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserGroup_ownerId_name_key" ON "UserGroup"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_answerCollectionId_userId_key" ON "Permission"("answerCollectionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_elementId_userId_key" ON "Permission"("elementId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_courseId_userId_key" ON "Permission"("courseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_liveQuizId_userId_key" ON "Permission"("liveQuizId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_practiceQuizId_userId_key" ON "Permission"("practiceQuizId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_microLearningId_userId_key" ON "Permission"("microLearningId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_groupActivityId_userId_key" ON "Permission"("groupActivityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_answerCollectionId_userGroupId_key" ON "Permission"("answerCollectionId", "userGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_elementId_userGroupId_key" ON "Permission"("elementId", "userGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_courseId_userGroupId_key" ON "Permission"("courseId", "userGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_liveQuizId_userGroupId_key" ON "Permission"("liveQuizId", "userGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_practiceQuizId_userGroupId_key" ON "Permission"("practiceQuizId", "userGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_microLearningId_userGroupId_key" ON "Permission"("microLearningId", "userGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_groupActivityId_userGroupId_key" ON "Permission"("groupActivityId", "userGroupId");

-- CreateIndex
CREATE INDEX "_UserGroupMembers_B_index" ON "_UserGroupMembers"("B");

-- AddForeignKey
ALTER TABLE "UserGroup" ADD CONSTRAINT "UserGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_objectOwnerId_fkey" FOREIGN KEY ("objectOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_answerCollectionId_fkey" FOREIGN KEY ("answerCollectionId") REFERENCES "AnswerCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserGroupMembers" ADD CONSTRAINT "_UserGroupMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserGroupMembers" ADD CONSTRAINT "_UserGroupMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ObjectType" ADD VALUE 'KB';
ALTER TYPE "ObjectType" ADD VALUE 'CHATBOT';

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "chatbotId" UUID,
ADD COLUMN     "kbId" UUID;

-- AlterTable
ALTER TABLE "DerivedPermission" ADD COLUMN     "chatbotId" UUID,
ADD COLUMN     "kbId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Permission_kbId_userId_key" ON "Permission"("kbId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_chatbotId_userId_key" ON "Permission"("chatbotId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_kbId_userGroupId_key" ON "Permission"("kbId", "userGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_chatbotId_userGroupId_key" ON "Permission"("chatbotId", "userGroupId");

-- CreateIndex
CREATE INDEX "DerivedPermission_kbId_permissionLevel_idx" ON "DerivedPermission"("kbId", "permissionLevel");

-- CreateIndex
CREATE INDEX "DerivedPermission_chatbotId_permissionLevel_idx" ON "DerivedPermission"("chatbotId", "permissionLevel");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedPermission_kbId_userId_key" ON "DerivedPermission"("kbId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedPermission_chatbotId_userId_key" ON "DerivedPermission"("chatbotId", "userId");

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedPermission" ADD CONSTRAINT "DerivedPermission_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedPermission" ADD CONSTRAINT "DerivedPermission_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma cannot represent the existing object-presence checks. Extend each
-- check so grants can reference either new object type.
ALTER TABLE "Permission"
    DROP CONSTRAINT "ObjectRequired",
    ADD CONSTRAINT "ObjectRequired" CHECK (
        "answerCollectionId" IS NOT NULL
        OR "elementId" IS NOT NULL
        OR "courseId" IS NOT NULL
        OR "liveQuizId" IS NOT NULL
        OR "practiceQuizId" IS NOT NULL
        OR "microLearningId" IS NOT NULL
        OR "groupActivityId" IS NOT NULL
        OR "catalogCollectionId" IS NOT NULL
        OR "kbId" IS NOT NULL
        OR "chatbotId" IS NOT NULL
    );
ALTER TABLE "DerivedPermission"
    DROP CONSTRAINT "ObjectRequired",
    ADD CONSTRAINT "ObjectRequired" CHECK (
        "answerCollectionId" IS NOT NULL
        OR "elementId" IS NOT NULL
        OR "courseId" IS NOT NULL
        OR "liveQuizId" IS NOT NULL
        OR "practiceQuizId" IS NOT NULL
        OR "microLearningId" IS NOT NULL
        OR "groupActivityId" IS NOT NULL
        OR "catalogCollectionId" IS NOT NULL
        OR "kbId" IS NOT NULL
        OR "chatbotId" IS NOT NULL
    );

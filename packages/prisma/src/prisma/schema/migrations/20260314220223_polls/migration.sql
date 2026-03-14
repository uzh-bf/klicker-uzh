/*
  Warnings:

  - A unique constraint covering the columns `[pollId,userId,objectAdminOrOwnerId]` on the table `AccessRequest` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[pollId]` on the table `ActivityTemplate` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[pollId,catalogCollectionId]` on the table `CatalogCollectionAssignment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[pollId,userId]` on the table `DerivedPermission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[pollId]` on the table `ElementStack` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[pollId,userId]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[pollId,userGroupId]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."AccessRequest" ADD COLUMN     "pollId" UUID;

-- AlterTable
ALTER TABLE "public"."ActivityLogEntry" ADD COLUMN     "pollId" UUID;

-- AlterTable
ALTER TABLE "public"."ActivityTemplate" ADD COLUMN     "pollId" UUID;

-- AlterTable
ALTER TABLE "public"."CatalogCollectionAssignment" ADD COLUMN     "pollId" UUID;

-- AlterTable
ALTER TABLE "public"."DerivedPermission" ADD COLUMN     "pollId" UUID;

-- AlterTable
ALTER TABLE "public"."ElementStack" ADD COLUMN     "pollId" UUID;

-- AlterTable
ALTER TABLE "public"."Permission" ADD COLUMN     "pollId" UUID;

-- CreateTable
CREATE TABLE "public"."Poll" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewStatus" "public"."ReviewStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "endDate" TIMESTAMP(3),
    "scheduledCompletionTaskId" TEXT,
    "areInstancesOutdated" BOOLEAN NOT NULL DEFAULT false,
    "templateName" TEXT,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PollInstance" (
    "id" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "lastAnsweredStackId" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PollInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessRequest_pollId_userId_idx" ON "public"."AccessRequest"("pollId", "userId");

-- CreateIndex
CREATE INDEX "AccessRequest_pollId_objectAdminOrOwnerId_idx" ON "public"."AccessRequest"("pollId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_pollId_userId_objectAdminOrOwnerId_key" ON "public"."AccessRequest"("pollId", "userId", "objectAdminOrOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplate_pollId_key" ON "public"."ActivityTemplate"("pollId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCollectionAssignment_pollId_catalogCollectionId_key" ON "public"."CatalogCollectionAssignment"("pollId", "catalogCollectionId");

-- CreateIndex
CREATE INDEX "DerivedPermission_pollId_permissionLevel_idx" ON "public"."DerivedPermission"("pollId", "permissionLevel");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedPermission_pollId_userId_key" ON "public"."DerivedPermission"("pollId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementStack_pollId_key" ON "public"."ElementStack"("pollId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_pollId_userId_key" ON "public"."Permission"("pollId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_pollId_userGroupId_key" ON "public"."Permission"("pollId", "userGroupId");

-- AddForeignKey
ALTER TABLE "public"."ElementStack" ADD CONSTRAINT "ElementStack_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Poll" ADD CONSTRAINT "Poll_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollInstance" ADD CONSTRAINT "PollInstance_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Permission" ADD CONSTRAINT "Permission_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccessRequest" ADD CONSTRAINT "AccessRequest_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DerivedPermission" ADD CONSTRAINT "DerivedPermission_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActivityTemplate" ADD CONSTRAINT "ActivityTemplate_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CatalogCollectionAssignment" ADD CONSTRAINT "CatalogCollectionAssignment_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActivityLogEntry" ADD CONSTRAINT "ActivityLogEntry_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update Custom Constraint on Permissions Table
ALTER TABLE "Permission" DROP CONSTRAINT "ObjectRequired";
ALTER TABLE "Permission" ADD CONSTRAINT "ObjectRequired" CHECK (
  ("answerCollectionId" IS NOT NULL) OR 
  ("elementId" IS NOT NULL) OR 
  ("courseId" IS NOT NULL) OR 
  ("liveQuizId" IS NOT NULL) OR 
  ("pollId" IS NOT NULL) OR
  ("practiceQuizId" IS NOT NULL) OR 
  ("microLearningId" IS NOT NULL) OR 
  ("groupActivityId" IS NOT NULL) OR
  ("catalogCollectionId" IS NOT NULL)
);

-- Update Custom Constraint on DerivedPermission Table
ALTER TABLE "DerivedPermission" DROP CONSTRAINT "ObjectRequired";
ALTER TABLE "DerivedPermission" ADD CONSTRAINT "ObjectRequired" CHECK (
  ("answerCollectionId" IS NOT NULL) OR 
  ("elementId" IS NOT NULL) OR 
  ("courseId" IS NOT NULL) OR 
  ("liveQuizId" IS NOT NULL) OR 
  ("pollId" IS NOT NULL) OR
  ("practiceQuizId" IS NOT NULL) OR 
  ("microLearningId" IS NOT NULL) OR 
  ("groupActivityId" IS NOT NULL) OR
  ("catalogCollectionId" IS NOT NULL)
);

-- Update Custom Constraint on AccessRequest Table
ALTER TABLE "AccessRequest" DROP CONSTRAINT "ObjectRequired";
ALTER TABLE "AccessRequest" ADD CONSTRAINT "ObjectRequired" CHECK (
  ("answerCollectionId" IS NOT NULL) OR 
  ("elementId" IS NOT NULL) OR 
  ("courseId" IS NOT NULL) OR 
  ("liveQuizId" IS NOT NULL) OR 
  ("pollId" IS NOT NULL) OR
  ("practiceQuizId" IS NOT NULL) OR 
  ("microLearningId" IS NOT NULL) OR 
  ("groupActivityId" IS NOT NULL) OR
  ("catalogCollectionId" IS NOT NULL)
);

-- Update Custom Constraint on ActivityLogEntry Table
ALTER TABLE "ActivityLogEntry" DROP CONSTRAINT "ObjectRequired";
ALTER TABLE "ActivityLogEntry" ADD CONSTRAINT "ObjectRequired" CHECK (
  ("answerCollectionId" IS NOT NULL) OR 
  ("elementId" IS NOT NULL) OR 
  ("courseId" IS NOT NULL) OR 
  ("liveQuizId" IS NOT NULL) OR 
  ("pollId" IS NOT NULL) OR
  ("practiceQuizId" IS NOT NULL) OR 
  ("microLearningId" IS NOT NULL) OR 
  ("groupActivityId" IS NOT NULL)
);

-- Update Custom Constraint on CatalogCollectionAssignment Table
ALTER TABLE "CatalogCollectionAssignment" DROP CONSTRAINT "ObjectRequired";
ALTER TABLE "CatalogCollectionAssignment" ADD CONSTRAINT "ObjectRequired" CHECK (
  ("answerCollectionId" IS NOT NULL) OR 
  ("elementId" IS NOT NULL) OR 
  ("courseId" IS NOT NULL) OR 
  ("liveQuizId" IS NOT NULL) OR 
  ("pollId" IS NOT NULL) OR
  ("practiceQuizId" IS NOT NULL) OR 
  ("microLearningId" IS NOT NULL) OR 
  ("groupActivityId" IS NOT NULL)
);




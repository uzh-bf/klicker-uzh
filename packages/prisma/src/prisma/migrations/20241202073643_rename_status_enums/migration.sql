-- Drop old element stack types
ALTER TABLE "ElementStack" DROP COLUMN "type";
DROP TYPE "ElementStackType";

-- Rename ElementStackTypeNew enum to ElementStackType
ALTER TYPE "ElementStackTypeNew" RENAME TO "ElementStackType";

-- Rename typeNEW column to type on ElementStack table
ALTER TABLE "ElementStack" RENAME COLUMN "typeNEW" TO "type";

-- Drop status column on GroupActivity table
ALTER TABLE "GroupActivity" DROP COLUMN "status";

-- Rename status column to statusNEW on GroupActivity table
ALTER TABLE "GroupActivity" RENAME COLUMN "statusNEW" TO "status";

-- AlterTable
ALTER TABLE "ElementStack" ALTER COLUMN "type" SET NOT NULL;

-- DropEnum
DROP TYPE "GroupActivityStatus";

-- CreateIndex
CREATE UNIQUE INDEX "ElementStack_type_practiceQuizId_order_key" ON "ElementStack"("type", "practiceQuizId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ElementStack_type_microLearningId_order_key" ON "ElementStack"("type", "microLearningId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ElementStack_type_groupActivityId_order_key" ON "ElementStack"("type", "groupActivityId", "order");

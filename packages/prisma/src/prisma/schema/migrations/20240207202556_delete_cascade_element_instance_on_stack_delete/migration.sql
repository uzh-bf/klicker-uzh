-- DropForeignKey
ALTER TABLE "ElementInstance" DROP CONSTRAINT "ElementInstance_elementStackId_fkey";

-- AddForeignKey
ALTER TABLE "ElementInstance" ADD CONSTRAINT "ElementInstance_elementStackId_fkey" FOREIGN KEY ("elementStackId") REFERENCES "ElementStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

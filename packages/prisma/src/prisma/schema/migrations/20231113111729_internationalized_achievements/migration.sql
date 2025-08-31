-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN     "descriptionDE" TEXT,
ADD COLUMN     "descriptionEN" TEXT,
ADD COLUMN     "nameDE" TEXT,
ADD COLUMN     "nameEN" TEXT,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;

/*
  Warnings:

  - Added the required column `descriptionDE` to the `Achievement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `descriptionEN` to the `Achievement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameDE` to the `Achievement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameEN` to the `Achievement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN     "descriptionDE" TEXT NOT NULL,
ADD COLUMN     "descriptionEN" TEXT NOT NULL,
ADD COLUMN     "nameDE" TEXT NOT NULL,
ADD COLUMN     "nameEN" TEXT NOT NULL,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;

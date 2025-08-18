/*
  Warnings:

  - You are about to drop the column `accessLevel` on the `Permission` table. All the data in the column will be lost.
  - Added the required column `permissionLevel` to the `Permission` table without a default value. This is not possible if the table is not empty.

*/

-- Rename enum
ALTER TYPE "AccessLevel" RENAME TO "PermissionLevel";

-- AlterTable
ALTER TABLE "Permission" RENAME COLUMN "accessLevel" TO "permissionLevel";
ALTER TABLE "Permission" ALTER COLUMN "permissionLevel" TYPE "PermissionLevel";

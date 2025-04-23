/*
  Warnings:

  - The values [PERMISSION_REQUESTED,PERMISSION_DENIED,PERMISSION_CONVERTED] on the enum `AuditLogType` will be removed. If these variants are still used in the database, this will fail.
  - Made the column `ownerId` on table `AnswerCollection` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AuditLogType_new" AS ENUM ('PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'PERMISSION_REMOVED', 'PERMISSION_MODIFIED', 'OWNER_TRANSFERRED', 'REQUEST_CREATED', 'REQUEST_CANCELLED', 'REQUEST_RESOLVED', 'CATALOG_ASSIGNMENT_CREATED', 'CATALOG_ASSIGNMENT_DELETED', 'CATALOG_ASSIGNMENT_MODIFIED', 'USER_GROUP_CREATED', 'USER_GROUP_MODIFIED', 'USER_GROUP_DELETED', 'USER_GROUP_USER_ADDED', 'USER_GROUP_USER_REMOVED', 'USER_GROUP_USER_MODIFIED');
ALTER TABLE "AuditLogEntry" ALTER COLUMN "type" TYPE "AuditLogType_new" USING ("type"::text::"AuditLogType_new");
ALTER TYPE "AuditLogType" RENAME TO "AuditLogType_old";
ALTER TYPE "AuditLogType_new" RENAME TO "AuditLogType";
DROP TYPE "AuditLogType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "ObjectType" ADD VALUE 'USER_GROUP';

-- DropForeignKey
ALTER TABLE "AnswerCollection" DROP CONSTRAINT "AnswerCollection_ownerId_fkey";

-- AlterTable
ALTER TABLE "AnswerCollection" ALTER COLUMN "ownerId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "AnswerCollection" ADD CONSTRAINT "AnswerCollection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

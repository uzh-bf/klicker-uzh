ALTER TABLE "Session" RENAME TO "LiveSession";
ALTER TABLE "LiveSession" RENAME CONSTRAINT "Session_pkey" TO "LiveSession_pkey";
ALTER TABLE "LiveSession" RENAME CONSTRAINT "Session_activeBlockId_fkey" TO "LiveSession_activeBlockId_fkey";
ALTER TABLE "LiveSession" RENAME CONSTRAINT "Session_courseId_fkey" TO "LiveSession_courseId_fkey";
ALTER TABLE "LiveSession" RENAME CONSTRAINT "Session_ownerId_fkey" TO "LiveSession_ownerId_fkey";

-- Mark courses whose deletion has been requested and is pending permanent deletion
ALTER TABLE "Course" ADD COLUMN "deletionRequestedAt" TIMESTAMP(3);

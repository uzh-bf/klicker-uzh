-- Create the durable provider-dispatch claim used to distinguish an
-- unattempted dispatch from an accepted-but-uncorrelated external run.
ALTER TABLE "public"."KBGraphBuild"
ADD COLUMN "dispatchClaimedAt" TIMESTAMP(3);

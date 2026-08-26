-- Preserve the exact resource set used by every graph build. These source
-- snapshots deliberately have no resource FK: a build remains auditable after
-- a resource is deleted from its KB.
ALTER TABLE "public"."KBGraphBuild"
ADD COLUMN "cleanedAt" TIMESTAMP(3);

ALTER TABLE "public"."KBGraphBuild"
ADD COLUMN "cleanupStartedAt" TIMESTAMP(3);

CREATE TABLE "public"."KBGraphBuildSource" (
    "id" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "public"."KBResourceType" NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "blobName" TEXT,
    "buildId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KBGraphBuildSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KBGraphBuildSource_buildId_resourceId_key"
ON "public"."KBGraphBuildSource"("buildId", "resourceId");

CREATE INDEX "KBGraphBuildSource_resourceId_idx"
ON "public"."KBGraphBuildSource"("resourceId");

ALTER TABLE "public"."KBGraphBuildSource"
ADD CONSTRAINT "KBGraphBuildSource_buildId_fkey"
FOREIGN KEY ("buildId") REFERENCES "public"."KBGraphBuild"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

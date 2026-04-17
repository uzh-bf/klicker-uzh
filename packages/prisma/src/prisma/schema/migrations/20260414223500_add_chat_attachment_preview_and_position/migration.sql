-- AlterTable
ALTER TABLE "public"."ChatAttachment"
ADD COLUMN "position" INTEGER,
ADD COLUMN "imagePreviewBase64" TEXT;

-- Backfill deterministic zero-based attachment ordering per message.
WITH ranked AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "messageId"
            ORDER BY "createdAt" ASC, "id" ASC
        ) - 1 AS rn
    FROM "public"."ChatAttachment"
)
UPDATE "public"."ChatAttachment" AS attachment
SET "position" = ranked.rn
FROM ranked
WHERE ranked."id" = attachment."id";

ALTER TABLE "public"."ChatAttachment"
ALTER COLUMN "position" SET NOT NULL;

-- DropIndex
DROP INDEX "public"."ChatAttachment_messageId_idx";

-- CreateIndex
CREATE INDEX "ChatAttachment_messageId_position_idx"
ON "public"."ChatAttachment"("messageId", "position");

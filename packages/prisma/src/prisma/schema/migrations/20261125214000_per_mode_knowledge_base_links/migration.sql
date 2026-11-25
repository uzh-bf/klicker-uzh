BEGIN;

-- AlterTable
ALTER TABLE "ResponseExample" ADD COLUMN     "sourceKbLinkId" UUID;

-- AlterTable
ALTER TABLE "KBChatbot" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Preserve live grants only when the owner and the old managed projection agree.
-- MCP-only configurations have no managed link and are left untouched.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "KBChatbot" link
    JOIN "KB" kb ON kb.id = link."kbId"
    JOIN "Chatbot" bot ON bot.id = link."chatbotId"
    WHERE kb."ownerId" IS DISTINCT FROM bot."ownerId"
  ) THEN
    RAISE EXCEPTION 'Knowledge-base link ownership must be reconciled before migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "KBChatbot" link
    JOIN "ChatbotMCPConfig" config ON config."chatbotId" = link."chatbotId"
    JOIN "ChatbotMCPServer" server ON server.id = config."mcpServerId" AND server.name = 'KB'
    WHERE link."isEnabled" AND config."isEnabled"
      AND NOT COALESCE(
        (config.parameters->>'toolAlias' = 'doc_query') AND
        ((config.parameters->'required') = 'true'::jsonb) AND
        ((NOT (config.parameters ? 'kb_ids') AND lower(config.parameters->>'kb_id') = link."kbId"::text)
        OR (NOT (config.parameters ? 'kb_id') AND config.parameters->'kb_ids' = jsonb_build_array(link."kbId"::text))), false)
  ) THEN
    RAISE EXCEPTION 'Knowledge-base configuration must be reconciled before migration';
  END IF;
END $$;

UPDATE "ChatbotMCPConfig" config SET "isEnabled" = false
FROM "ChatbotMCPServer" server, "KBChatbot" link, "KB" kb
WHERE server.id = config."mcpServerId" AND server.name = 'KB'
  AND config."chatbotId" = link."chatbotId" AND config."isEnabled" AND link."isEnabled"
  AND kb.id = link."kbId" AND kb."deletedAt" IS NOT NULL;

UPDATE "KBChatbot" link SET "isEnabled" = false
FROM "KB" kb WHERE kb.id = link."kbId" AND kb."deletedAt" IS NOT NULL AND link."isEnabled";
UPDATE "KBChatbot" SET "isDefault" = true WHERE "isEnabled";

-- Capture a historical link only when it already existed when the example was
-- created and all of the stored source IDs identify resources in that KB.
UPDATE "ResponseExample" example SET "sourceKbLinkId" = link.id
FROM "ResponseExampleSet" set_, "KBChatbot" link
WHERE set_.id = example."setId" AND link."chatbotId" = set_."chatbotId"
  AND link."isDefault" AND link."createdAt" <= example."createdAt"
  AND EXISTS (SELECT 1 FROM "ResponseExampleEvidenceReference" ref WHERE ref."responseExampleId" = example.id)
  AND NOT EXISTS (
    SELECT 1 FROM "ResponseExampleEvidenceReference" ref
    WHERE ref."responseExampleId" = example.id AND NOT EXISTS (
      SELECT 1 FROM "KBResource" resource WHERE resource.id::text = ref."sourceId" AND resource."kbId" = link."kbId"
    )
  );

-- Prisma cannot express the default-implies-enabled check or this partial index.
ALTER TABLE "KBChatbot" ADD CONSTRAINT "KBChatbot_default_requires_enabled"
  CHECK (NOT "isDefault" OR "isEnabled");
DROP INDEX "KBChatbot_one_enabled_per_chatbot_key";
CREATE UNIQUE INDEX "KBChatbot_one_default_per_chatbot_key" ON "KBChatbot" ("chatbotId")
  WHERE "isEnabled" AND "isDefault";

COMMIT;

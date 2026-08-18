-- The KB MCP server now authenticates with a per-request doc-query scope token.
-- Chat refuses to load a server named 'KB' on any other auth type, so an
-- environment whose row still carries the old value would lose knowledge
-- retrieval; the seed alone does not reach deployed databases.
-- Idempotent: rows already migrated are excluded.
UPDATE "public"."ChatbotMCPServer"
SET "authType" = 'scope_token',
    "passChatbotId" = false,
    "chatbotIdHeader" = NULL,
    "authSecret" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'KB'
  AND "authType" <> 'scope_token';

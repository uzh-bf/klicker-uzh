-- Data-only migration: "gpt-4.1" and "gpt-5.4" leave the deployed chat model
-- registries and have no successor id. Prisma cannot generate data updates, so
-- this SQL is hand-written. It drops both ids from live and stored chatbot
-- policies the same way 20260929120000_chat_gpt6_base_model drops "gpt-5.1".
-- Submission and approval reject a policy that names a model the registry
-- lacks, and drafts are copied from the live policy, so both must be clean for
-- later edits to stay submittable. A list left empty falls back to the base
-- model. Every statement matches only rows that still carry a retired id, so a
-- re-run changes nothing.

UPDATE "Chatbot" AS c
SET "allowedModelIds" = COALESCE(
  NULLIF(
    array_remove(array_remove(c."allowedModelIds", 'gpt-4.1'), 'gpt-5.4'),
    '{}'
  ),
  ARRAY['gpt-6-luna']
)
WHERE c."allowedModelIds" && ARRAY['gpt-4.1', 'gpt-5.4'];

UPDATE "Chatbot"
SET "allowedReasoningEffortsByModel" =
  "allowedReasoningEffortsByModel" - ARRAY['gpt-4.1', 'gpt-5.4']
WHERE jsonb_typeof("allowedReasoningEffortsByModel") = 'object'
  AND "allowedReasoningEffortsByModel" ?| ARRAY['gpt-4.1', 'gpt-5.4'];

UPDATE "Chatbot"
SET "draftConfig" = jsonb_set(
  "draftConfig",
  '{allowedModelIds}',
  COALESCE(
    NULLIF(
      ("draftConfig" -> 'allowedModelIds') - ARRAY['gpt-4.1', 'gpt-5.4'],
      '[]'::jsonb
    ),
    '["gpt-6-luna"]'::jsonb
  )
)
WHERE jsonb_typeof("draftConfig") = 'object'
  AND jsonb_typeof("draftConfig" -> 'allowedModelIds') = 'array'
  AND "draftConfig" -> 'allowedModelIds' ?| ARRAY['gpt-4.1', 'gpt-5.4'];

UPDATE "Chatbot"
SET "draftConfig" = jsonb_set(
  "draftConfig",
  '{allowedReasoningEffortsByModel}',
  ("draftConfig" -> 'allowedReasoningEffortsByModel') - ARRAY['gpt-4.1', 'gpt-5.4']
)
WHERE jsonb_typeof("draftConfig") = 'object'
  AND jsonb_typeof("draftConfig" -> 'allowedReasoningEffortsByModel') = 'object'
  AND "draftConfig" -> 'allowedReasoningEffortsByModel' ?| ARRAY['gpt-4.1', 'gpt-5.4'];

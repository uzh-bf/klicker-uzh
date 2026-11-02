-- Data-only migration: "gpt-4.1-mini" and "gpt-5.5" are absent from the
-- built-in and deployed chat model registries, yet published chatbots still
-- name them. Prisma cannot generate data updates, so this SQL is hand-written
-- and mirrors 20261008120000_chat_drop_retired_model_ids. Submission and
-- approval reject a policy that names a model the registry lacks, and drafts
-- are copied from the live policy, so both must be clean for later edits to
-- stay submittable. A list left empty falls back to the base model. Every
-- statement matches only rows that still carry one of these ids, so a re-run
-- changes nothing.

UPDATE "Chatbot" AS c
SET "allowedModelIds" = COALESCE(
  NULLIF(
    array_remove(array_remove(c."allowedModelIds", 'gpt-4.1-mini'), 'gpt-5.5'),
    '{}'
  ),
  ARRAY['gpt-6-luna']
)
WHERE c."allowedModelIds" && ARRAY['gpt-4.1-mini', 'gpt-5.5'];

UPDATE "Chatbot"
SET "allowedReasoningEffortsByModel" =
  "allowedReasoningEffortsByModel" - ARRAY['gpt-4.1-mini', 'gpt-5.5']
WHERE jsonb_typeof("allowedReasoningEffortsByModel") = 'object'
  AND "allowedReasoningEffortsByModel" ?| ARRAY['gpt-4.1-mini', 'gpt-5.5'];

UPDATE "Chatbot"
SET "draftConfig" = jsonb_set(
  "draftConfig",
  '{allowedModelIds}',
  COALESCE(
    NULLIF(
      ("draftConfig" -> 'allowedModelIds') - ARRAY['gpt-4.1-mini', 'gpt-5.5'],
      '[]'::jsonb
    ),
    '["gpt-6-luna"]'::jsonb
  )
)
WHERE jsonb_typeof("draftConfig") = 'object'
  AND jsonb_typeof("draftConfig" -> 'allowedModelIds') = 'array'
  AND "draftConfig" -> 'allowedModelIds' ?| ARRAY['gpt-4.1-mini', 'gpt-5.5'];

UPDATE "Chatbot"
SET "draftConfig" = jsonb_set(
  "draftConfig",
  '{allowedReasoningEffortsByModel}',
  ("draftConfig" -> 'allowedReasoningEffortsByModel') - ARRAY['gpt-4.1-mini', 'gpt-5.5']
)
WHERE jsonb_typeof("draftConfig") = 'object'
  AND jsonb_typeof("draftConfig" -> 'allowedReasoningEffortsByModel') = 'object'
  AND "draftConfig" -> 'allowedReasoningEffortsByModel' ?| ARRAY['gpt-4.1-mini', 'gpt-5.5'];

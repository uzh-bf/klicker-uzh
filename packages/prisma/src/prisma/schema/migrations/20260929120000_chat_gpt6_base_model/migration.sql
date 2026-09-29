-- Data-only migration: the participant base model id changes from
-- "gpt-5.6-luna" to "gpt-6-luna". Prisma cannot generate data updates, so this
-- SQL is hand-written. Every statement matches only rows that still carry the
-- old id, so a re-run changes nothing.
--
-- Reverse (manual rollback, together with the previous registry and images):
--   swap the two ids in the same statements.

-- Replace the old id in each allow-list, keeping the first position of either
-- id and never listing the new id twice.
UPDATE "Chatbot" AS c
SET "allowedModelIds" = ARRAY(
  SELECT t.model_id
  FROM (
    SELECT
      CASE WHEN u.model_id = 'gpt-5.6-luna' THEN 'gpt-6-luna' ELSE u.model_id END AS model_id,
      MIN(u.ord) AS first_ord
    FROM unnest(c."allowedModelIds") WITH ORDINALITY AS u(model_id, ord)
    GROUP BY 1
  ) AS t
  ORDER BY t.first_ord
)
WHERE 'gpt-5.6-luna' = ANY(c."allowedModelIds");

-- Move per-model reasoning-effort settings to the new key. An existing entry
-- for the new id wins; the old key is dropped either way.
UPDATE "Chatbot"
SET "allowedReasoningEffortsByModel" =
  ("allowedReasoningEffortsByModel" - 'gpt-5.6-luna')
  || CASE
    WHEN "allowedReasoningEffortsByModel" ? 'gpt-6-luna' THEN '{}'::jsonb
    ELSE jsonb_build_object('gpt-6-luna', "allowedReasoningEffortsByModel" -> 'gpt-5.6-luna')
  END
WHERE jsonb_typeof("allowedReasoningEffortsByModel") = 'object'
  AND "allowedReasoningEffortsByModel" ? 'gpt-5.6-luna';

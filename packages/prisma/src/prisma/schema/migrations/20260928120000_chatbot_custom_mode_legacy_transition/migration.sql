BEGIN;

-- Hand-written data transition: the Prisma migration tool can express the new
-- column but not the per-entry conversion of the legacy JSON shape. The
-- transition is additive and idempotent: it only fills "customModeConfig" for
-- PUBLISHED chatbots that have none, and seeds the matching field into a saved
-- authoring revision when that revision object lacks it. The legacy
-- "systemPrompts" values are intentionally never rewritten, because messages,
-- response examples, and MCP bindings still reference their keys.
UPDATE "Chatbot"
SET "customModeConfig" = jsonb_build_object(
      'modes',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'key', "entry"."key",
            'name', left(initcap("entry"."key"), 60),
            'description',
              left(
                COALESCE(
                  NULLIF("entry"."value"->>'description', ''),
                  'Imported from the previous custom mode configuration.'
                ),
                160
              ),
            'personaText', left("entry"."value"->>'prompt', 1000)
          )
          ORDER BY "entry"."key"
        )
        FROM (
          SELECT "entry"."key", "entry"."value"
          FROM jsonb_each("systemPrompts") AS "entry"("key", "value")
          WHERE "entry"."key" NOT IN ('tutor', 'explainer', 'quizzer')
            AND jsonb_typeof("entry"."value") = 'object'
            AND ("entry"."value"->>'enabled') IS DISTINCT FROM 'false'
            AND COALESCE(left("entry"."value"->>'prompt', 1000), '') <> ''
          ORDER BY "entry"."key"
          LIMIT 5
        ) AS "entry"("key", "value")
      ), '[]'::jsonb)
    )
WHERE "status" = 'PUBLISHED'
  AND "customModeConfig" IS NULL
  AND jsonb_typeof("systemPrompts") = 'object'
  AND EXISTS (
    SELECT 1
    FROM jsonb_each("systemPrompts") AS "entry"("key", "value")
    WHERE "entry"."key" NOT IN ('tutor', 'explainer', 'quizzer')
      AND jsonb_typeof("entry"."value") = 'object'
      AND ("entry"."value"->>'enabled') IS DISTINCT FROM 'false'
      AND COALESCE(left("entry"."value"->>'prompt', 1000), '') <> ''
  );

UPDATE "Chatbot"
SET "draftConfig" = jsonb_set(
      "draftConfig",
      '{customModeConfig}',
      CASE
        WHEN "customModeConfig" IS NULL THEN 'null'::jsonb
        ELSE "customModeConfig"
      END,
      true
    )
WHERE jsonb_typeof("draftConfig") = 'object'
  AND NOT ("draftConfig" ? 'customModeConfig');

COMMIT;

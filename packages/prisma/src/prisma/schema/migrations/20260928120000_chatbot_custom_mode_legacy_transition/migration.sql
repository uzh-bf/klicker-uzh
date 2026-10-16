BEGIN;

-- Hand-written data transition: the Prisma migration tool can express the new
-- column but not the per-entry conversion of the legacy JSON shape. It carries
-- every legacy custom mode that the previous runtime offered to participants
-- into "customModeConfig", for chatbots in every status: any non-built-in
-- "systemPrompts" key with a non-blank name that is not explicitly disabled.
-- The transition is additive and idempotent: it only fills "customModeConfig"
-- where it is still NULL, and seeds the matching field into a saved authoring
-- revision that lacks it. The legacy "systemPrompts" values are intentionally
-- never rewritten, because messages, response examples, and MCP bindings still
-- reference their keys.
--
-- Converted values satisfy the stored-mode reader, which otherwise drops an
-- entry: a chatbot keeps at most its first five modes by key, the ones the
-- reader would keep; names are single-line, at most 60 characters, unique
-- ignoring case, and never a reserved built-in name; descriptions are
-- single-line and at most 160 characters. A legacy prompt becomes "personaText" up to the stored
-- 100,000-character ceiling, so lecturers see and edit the prompt that runs. A
-- longer prompt is left out of "personaText", so the runtime keeps compiling
-- the full legacy prompt from "systemPrompts" instead of a truncated copy.
WITH "legacy" AS (
  SELECT
    "c"."id" AS "chatbotId",
    "entry"."key",
    "entry"."value",
    left(
      btrim(regexp_replace(initcap("entry"."key"), '\s+', ' ', 'g')),
      60
    ) AS "baseName",
    row_number() OVER (
      PARTITION BY "c"."id"
      ORDER BY "entry"."key"
    ) AS "keyRank"
  FROM "Chatbot" AS "c"
  CROSS JOIN LATERAL jsonb_each("c"."systemPrompts") AS "entry"("key", "value")
  WHERE "c"."customModeConfig" IS NULL
    AND jsonb_typeof("c"."systemPrompts") = 'object'
    AND "entry"."key" NOT IN ('tutor', 'explainer', 'quizzer')
    AND btrim("entry"."key") <> ''
    AND ("entry"."value"->'enabled') IS DISTINCT FROM 'false'::jsonb
),
"ranked" AS (
  SELECT
    "legacy".*,
    row_number() OVER (
      PARTITION BY "chatbotId", lower("baseName")
      ORDER BY "key"
    ) AS "nameRank"
  FROM "legacy"
  WHERE "keyRank" <= 5
),
"converted" AS (
  SELECT
    "chatbotId",
    "key",
    CASE
      WHEN "nameRank" = 1
        AND lower("baseName") NOT IN ('tutor', 'explainer', 'quizzer')
      THEN "baseName"
      ELSE left("baseName", 54) || ' (' || ("nameRank" + 1) || ')'
    END AS "name",
    CASE
      WHEN jsonb_typeof("value") = 'object'
        AND jsonb_typeof("value"->'description') = 'string'
      THEN NULLIF(
        left(
          btrim(regexp_replace("value"->>'description', '\s+', ' ', 'g')),
          160
        ),
        ''
      )
    END AS "description",
    CASE
      WHEN jsonb_typeof("value") = 'object'
        AND jsonb_typeof("value"->'prompt') = 'string'
        AND length(btrim("value"->>'prompt')) BETWEEN 1 AND 100000
      THEN btrim(replace(replace("value"->>'prompt', E'\r\n', E'\n'), E'\r', E'\n'))
    END AS "personaText"
  FROM "ranked"
),
"configs" AS (
  SELECT
    "chatbotId",
    jsonb_build_object(
      'modes',
      jsonb_agg(
        jsonb_build_object(
          'key', "key",
          'name', "name",
          'description', "description",
          'personaText', "personaText"
        )
        ORDER BY "key"
      )
    ) AS "config"
  FROM "converted"
  GROUP BY "chatbotId"
)
UPDATE "Chatbot"
SET "customModeConfig" = "configs"."config"
FROM "configs"
WHERE "Chatbot"."id" = "configs"."chatbotId";

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

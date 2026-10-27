-- AlterTable
ALTER TABLE "Chatbot" ALTER COLUMN "knowledgeGraphVisible" SET DEFAULT false;

-- Existing live and staged policies require explicit opt-in after first rollout.
-- JSON patching preserves every unrelated revision setting.
UPDATE "Chatbot"
SET "knowledgeGraphVisible" = false,
    "draftConfig" = CASE
      WHEN jsonb_typeof("draftConfig") = 'object'
        THEN jsonb_set("draftConfig", '{knowledgeGraphVisible}', 'false'::jsonb, true)
      ELSE "draftConfig"
    END,
    "revisionVersion" = "revisionVersion" + 1
WHERE "knowledgeGraphVisible" = true
   OR (jsonb_typeof("draftConfig") = 'object'
       AND "draftConfig"->'knowledgeGraphVisible' IS DISTINCT FROM 'false'::jsonb);

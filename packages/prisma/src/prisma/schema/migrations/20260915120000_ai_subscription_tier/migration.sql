BEGIN;

-- CreateEnum
CREATE TYPE "AiSubscriptionTier" AS ENUM ('BASE', 'ADVANCED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiSubscriptionTier" "AiSubscriptionTier" NOT NULL DEFAULT 'BASE';

-- Manual data step: an empty allow-list with participant model selection
-- offers every registry model, including ADVANCED models the owner may not be
-- entitled to. Pin those chatbots to the BASE models of the deployed
-- registries so participants keep a working choice. Ids a registry lacks are
-- dropped when the allow-list is read.
UPDATE "Chatbot"
SET "allowedModelIds" = ARRAY['gpt-6-luna', 'auto', 'gpt-5.6-luna']
WHERE "modelSelection" AND cardinality("allowedModelIds") = 0;

COMMIT;

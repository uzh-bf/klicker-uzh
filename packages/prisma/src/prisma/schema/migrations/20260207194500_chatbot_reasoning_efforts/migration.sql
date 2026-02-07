-- Store per-model lecturer restrictions for reasoning effort levels.
ALTER TABLE "public"."Chatbot"
ADD COLUMN "allowedReasoningEffortsByModel" JSONB;

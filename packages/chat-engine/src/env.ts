// Engine configuration read from the runtime environment. The host service
// (apps/chat-api) injects these — in KlickerUZH via Infisical at runtime, no
// .env files. Names mirror what apps/chat consumes.
//
// OPENAI_API_KEY / OPENAI_BASE_URL are WARNED (not thrown) when absent, mirroring
// apps/chat. agent.ts and guardrails.ts construct providers at module load, so a
// throw here would crash any importer that has not set model env — including a
// /health probe or a unit test that only needs a type or pure helper. Model calls
// still fail loudly at request time when the provider is genuinely unconfigured.
function warnIfMissing(name: string): string | undefined {
  const v = process.env[name]
  if (!v) {
    console.warn(
      `[chat-engine] ${name} is not set — model requests will use provider defaults or fail without a per-chatbot key`
    )
  }
  return v
}

export const env = {
  // Model provider (Azure AI Foundry / OpenAI-compatible). apps/chat builds
  // @ai-sdk/openai against an OpenAI-compatible base URL (LiteLLM -> Azure in
  // prod; Azure's /openai/v1 surface directly in dev).
  OPENAI_API_KEY: warnIfMissing('OPENAI_API_KEY'),
  OPENAI_BASE_URL: warnIfMissing('OPENAI_BASE_URL'),
  // Fallback model deployment name used when the requested primary errors
  // (5xx/429/timeout) — Mastra retries the next entry in the model list.
  FALLBACK_MODEL_ID: process.env.FALLBACK_MODEL_ID ?? 'gpt-4.1-mini',
  // Classifier model for the LLM-backed guardrail processors (prompt-injection,
  // moderation, PII). Reuse the cheap one.
  GUARDRAIL_MODEL_ID: process.env.GUARDRAIL_MODEL_ID ?? 'gpt-4.1-mini',
  // Observability: 'console' prints Mastra spans to stdout; 'off' (default)
  // keeps runs quiet. Production points an OTLP/Langfuse-compatible exporter
  // here without touching agent code.
  OBSERVABILITY: process.env.OBSERVABILITY ?? 'off',
}

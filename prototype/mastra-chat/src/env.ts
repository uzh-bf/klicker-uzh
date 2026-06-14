// Env is injected by Infisical at runtime (no .env files). Run via:
//   infisical run --env=dev --path=/ -- pnpm start
// These names mirror what the chat app consumes today.

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name} (inject via Infisical)`)
  return v
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined
}

export const env = {
  // Model provider (OpenRouter / Azure / OpenAI-compatible) — mirrors the chat app
  OPENAI_API_KEY: required('OPENAI_API_KEY'),
  OPENAI_BASE_URL: required('OPENAI_BASE_URL'),
  // Legacy doc_query MCP server (used by the chat app via getMCPTools)
  MCP_ORIGIN: optional('MCP_ORIGIN'),
  MCP_KEY: optional('MCP_KEY'),
  // Klicker store (local dev copy)
  DATABASE_URL: required('DATABASE_URL'),
  APP_SECRET: optional('APP_SECRET'),
  // Prototype knobs
  PORT: Number(process.env.PORT ?? 7100),
  // Local stub doc_query MCP server (the real KB backend is not running in dev).
  // The rebind reads auth/header config from the DB KB row but connects here.
  PROTO_MCP_PORT: Number(process.env.PROTO_MCP_PORT ?? 7110),
  PROTO_MCP_URL: process.env.PROTO_MCP_URL ?? 'http://localhost:7110/mcp',
  // Guardrail processors need a classifier model (LLM-backed). Reuse the cheap one.
  GUARDRAIL_MODEL_ID: process.env.GUARDRAIL_MODEL_ID ?? 'openai/gpt-4.1-mini',
  // A1 observability: 'console' prints Mastra spans to stdout (offline emission
  // proof); 'off' (default) keeps local runs quiet. Production would point an
  // OTLP/Langfuse-compatible exporter here instead.
  OBSERVABILITY: process.env.OBSERVABILITY ?? 'off',
  // Default model ids (override per chatbot row). Primary deliberately swappable
  // to a bad id to exercise fallback in S0.
  PRIMARY_MODEL_ID: process.env.PRIMARY_MODEL_ID ?? 'openai/gpt-4.1',
  FALLBACK_MODEL_ID: process.env.FALLBACK_MODEL_ID ?? 'openai/gpt-4.1-mini',
  // A2 reasoning validation: a reasoning-capable model. The step-1 transport
  // check confirmed OpenRouter surfaces reasoning over Chat Completions (under a
  // `reasoning` delta field) for o4-mini. Override to test another reasoning model.
  REASONING_MODEL_ID: process.env.REASONING_MODEL_ID ?? 'openai/o4-mini',
}

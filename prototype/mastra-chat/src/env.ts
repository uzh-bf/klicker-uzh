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
  // Default model ids (override per chatbot row). Primary deliberately swappable
  // to a bad id to exercise fallback in S0.
  PRIMARY_MODEL_ID: process.env.PRIMARY_MODEL_ID ?? 'openai/gpt-4.1',
  FALLBACK_MODEL_ID: process.env.FALLBACK_MODEL_ID ?? 'openai/gpt-4.1-mini',
}

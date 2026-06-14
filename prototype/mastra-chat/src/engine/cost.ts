// A1 — model pricing + cost calculation, mirroring apps/chat's `calcCost`.
// Prices are USD per million tokens (same shape as the chat model registry's
// `cost` field). `calcCost` reproduces the formula in
// apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts exactly, so the
// prototype's `creditsUsed` is computed the same way production does.
export type CostBase = { input: number; output: number }

// Mirrors DEFAULT_MODEL_REGISTRY cost values in
// apps/chat/src/lib/server/chatModelRegistry.ts. Keyed by bare model id; the
// prototype uses provider-prefixed ids (e.g. "openai/gpt-4.1"), so lookups
// strip the provider prefix.
const MODEL_COST: Record<string, CostBase> = {
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  // Embedding model (input-only) for A3 background-cost attribution.
  'text-embedding-3-small': { input: 0.02, output: 0 },
}

// Look up the price for a model id, tolerating an optional provider prefix
// (slice from the last '/' — with no '/', lastIndexOf returns -1 and we keep the
// whole id). Returns null for unknown models so the caller can emit
// `creditsUsed: null` rather than silently charging zero; warns so the gap is
// visible (the prototype is deliberately run with a bad PRIMARY_MODEL_ID to test
// fallback — see env.ts).
export function costForModel(modelId: string): CostBase | null {
  const bare = modelId.slice(modelId.lastIndexOf('/') + 1)
  const cost = MODEL_COST[bare]
  if (!cost) {
    console.warn(`[cost] unknown model id, creditsUsed will be null: ${modelId}`)
    return null
  }
  return cost
}

// USD cost for a turn — identical formula to apps/chat's calcCost.
export function calcCost(costBase: CostBase, inputTokens: number, outputTokens: number): number {
  return (costBase.input * (inputTokens || 0) + costBase.output * (outputTokens || 0)) / 1_000_000
}

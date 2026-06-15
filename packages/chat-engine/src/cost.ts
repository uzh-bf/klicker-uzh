// Model pricing + cost calculation, mirroring apps/chat's `calcCost`. Prices are
// USD per million tokens (same shape as the chat model registry's `cost` field).
// `calcCost` reproduces the route's formula exactly, so the engine's
// `creditsUsed` is computed the same way production does.
//
// NOTE: this map duplicates the chatModelRegistry cost data. The registry is the
// single source of truth; collapsing this duplication (engine reads cost from the
// passed model config) is a planned Phase 6 cleanup.
export type CostBase = { input: number; output: number }

// Mirrors DEFAULT_MODEL_REGISTRY cost values in
// apps/chat/src/lib/server/chatModelRegistry.ts. Keyed by bare model id. Model
// ids are bare deployment names ("gpt-4.1"); the lastIndexOf strip in
// costForModel also tolerates an optional provider prefix, just in case.
const MODEL_COST: Record<string, CostBase> = {
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  // gpt-5 reasoning family — prod registry prices (deploy/env-uzh-prd/values.yaml).
  // Reasoning tokens are billed as output tokens, so they flow through `output`.
  'gpt-5.1': { input: 1.25, output: 10.0 },
  'gpt-5.4': { input: 1.25, output: 10.0 },
  'gpt-5.5': { input: 1.25, output: 10.0 },
  // Embedding model (input-only) for background-cost attribution.
  'text-embedding-3-small': { input: 0.02, output: 0 },
}

// Look up the price for a model id, tolerating an optional provider prefix
// (slice from the last '/' — with no '/', lastIndexOf returns -1 and we keep the
// whole id). Returns null for unknown models so the caller can emit
// `creditsUsed: null` rather than silently charging zero; warns so the gap is
// visible.
export function costForModel(modelId: string): CostBase | null {
  const bare = modelId.slice(modelId.lastIndexOf('/') + 1)
  const cost = MODEL_COST[bare]
  if (!cost) {
    console.warn(
      `[cost] unknown model id, creditsUsed will be null: ${modelId}`
    )
    return null
  }
  return cost
}

// USD cost for a turn — identical formula to apps/chat's calcCost.
export function calcCost(
  costBase: CostBase,
  inputTokens: number,
  outputTokens: number
): number {
  return (
    (costBase.input * (inputTokens || 0) +
      costBase.output * (outputTokens || 0)) /
    1_000_000
  )
}

// Token-count -> USD in one step, returning null for an unknown model (never a
// silent zero). The single cost-from-tokens path shared by the live chat stream
// (creditsUsed) and any background-operation cost attribution.
export function costForTokens(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const base = costForModel(modelId)
  return base ? calcCost(base, inputTokens, outputTokens) : null
}

// Render a nullable USD cost for display: a `$`-prefixed fixed-decimal string, or
// an explicit marker when the model price is unknown — never a bare "0" that
// reads as free.
export function formatCost(cost: number | null, decimals = 6): string {
  return cost === null ? 'n/a (unknown model)' : `$${cost.toFixed(decimals)}`
}

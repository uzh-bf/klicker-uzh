export type AggregateScope = {
  from: string
  to: string
  environment: string
  teamId: string
}

export type CostAggregate = {
  model: string
  generationCount: number
  inputTokens: number
  uncachedInputTokens: number
  cacheReadInputTokens: number
  cacheWriteInputTokens: number
  outputTokens: number
  totalCost: number
}

export type CostLedger = {
  scope: AggregateScope
  rows: CostAggregate[]
  assistantResponseCount: number | null
}

export type CostSummary = {
  generationCount: number
  inputTokens: number
  uncachedInputTokens: number
  cacheReadInputTokens: number
  cacheWriteInputTokens: number
  outputTokens: number
  totalCost: number
  assistantResponseCount: number | null
  cacheReadRate: number | null
  averageCostPerGeneration: number | null
  averageCostPerAssistantResponse: number | null
  modelDistribution: Array<{
    model: string
    generationCount: number
    share: number
    totalCost: number
  }>
}

export type ReconciliationResult = {
  status: 'reconciled' | 'incomplete' | 'mismatch'
  issues: string[]
  langfuse: CostSummary | null
  litellm: CostSummary | null
}

export class CostEvidenceError extends Error {}

type JsonObject = Record<string, unknown>

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CostEvidenceError(`${label} must be an object`)
  }
  return value as JsonObject
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new CostEvidenceError(`${label} must be an array`)
  }
  return value
}

function readRequiredNumber(
  object: JsonObject,
  candidates: string[],
  label: string,
  nested: JsonObject[] = []
) {
  for (const candidate of candidates) {
    const values = [object[candidate], ...nested.map((item) => item[candidate])]
    const value = values.find((item) => item !== undefined && item !== null)
    if (value === undefined || value === null || value === '') continue

    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(parsed)) {
      throw new CostEvidenceError(`${label} must be finite`)
    }
    return parsed
  }

  throw new CostEvidenceError(`${label} is missing`)
}

function readRequiredString(
  object: JsonObject,
  candidates: string[],
  label: string
) {
  for (const candidate of candidates) {
    const value = object[candidate]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  throw new CostEvidenceError(`${label} is missing`)
}

function validateAggregate(row: CostAggregate, label: string) {
  const integerFields: Array<keyof CostAggregate> = [
    'generationCount',
    'inputTokens',
    'uncachedInputTokens',
    'cacheReadInputTokens',
    'cacheWriteInputTokens',
    'outputTokens',
  ]

  for (const field of integerFields) {
    const value = row[field] as number
    if (!Number.isInteger(value) || value < 0) {
      throw new CostEvidenceError(
        `${label}.${field} must be a non-negative integer`
      )
    }
  }

  if (!Number.isFinite(row.totalCost) || row.totalCost < 0) {
    throw new CostEvidenceError(`${label}.totalCost must be non-negative`)
  }

  if (
    row.uncachedInputTokens +
      row.cacheReadInputTokens +
      row.cacheWriteInputTokens !==
    row.inputTokens
  ) {
    throw new CostEvidenceError(
      `${label} input buckets do not equal inclusive input tokens`
    )
  }
}

function addAggregate(
  rows: Map<string, CostAggregate>,
  next: CostAggregate,
  label: string
) {
  validateAggregate(next, label)
  const current = rows.get(next.model)
  if (!current) {
    rows.set(next.model, next)
    return
  }

  rows.set(next.model, {
    model: next.model,
    generationCount: current.generationCount + next.generationCount,
    inputTokens: current.inputTokens + next.inputTokens,
    uncachedInputTokens: current.uncachedInputTokens + next.uncachedInputTokens,
    cacheReadInputTokens:
      current.cacheReadInputTokens + next.cacheReadInputTokens,
    cacheWriteInputTokens:
      current.cacheWriteInputTokens + next.cacheWriteInputTokens,
    outputTokens: current.outputTokens + next.outputTokens,
    totalCost: current.totalCost + next.totalCost,
  })
}

function inputBuckets(object: JsonObject, nested: JsonObject[], label: string) {
  const inputTokens = readRequiredNumber(
    object,
    ['inputUsage', 'inputTokens', 'promptTokens', 'prompt_tokens', 'input'],
    `${label}.inputTokens`,
    nested
  )
  const cacheReadInputTokens = readRequiredNumber(
    object,
    [
      'cacheReadInputTokens',
      'cache_read_input_tokens',
      'cachedTokens',
      'cached_tokens',
    ],
    `${label}.cacheReadInputTokens`,
    nested
  )
  const cacheWriteInputTokens = readRequiredNumber(
    object,
    [
      'cacheWriteInputTokens',
      'cache_write_input_tokens',
      'cacheCreationInputTokens',
      'cache_creation_input_tokens',
    ],
    `${label}.cacheWriteInputTokens`,
    nested
  )
  const uncachedInputTokens =
    inputTokens - cacheReadInputTokens - cacheWriteInputTokens

  if (uncachedInputTokens < 0) {
    throw new CostEvidenceError(
      `${label} cache buckets exceed inclusive input tokens`
    )
  }

  return {
    inputTokens,
    uncachedInputTokens,
    cacheReadInputTokens,
    cacheWriteInputTokens,
  }
}

export function aggregateLangfuseObservations(
  payload: unknown,
  scope: AggregateScope
): CostLedger {
  const rows = asArray(payload, 'Langfuse observations')
  const aggregates = new Map<string, CostAggregate>()

  for (const [index, value] of rows.entries()) {
    const object = asObject(value, `Langfuse observation ${index}`)
    if (object.type !== undefined && object.type !== 'GENERATION') continue

    const totalCost = readRequiredNumber(
      object,
      ['totalCost', 'calculatedTotalCost', 'total_cost'],
      `Langfuse observation ${index}.totalCost`,
      [
        asObject(
          object.costDetails ?? {},
          `Langfuse observation ${index}.costDetails`
        ),
      ]
    )

    // Zero-cost observations are not part of the cost-bearing reconciliation
    // contract. This matches the gateway audit's positive-spend count grain.
    if (totalCost <= 0) continue

    const usageDetails = asObject(
      object.usageDetails ?? {},
      `Langfuse observation ${index}.usageDetails`
    )
    const buckets = inputBuckets(
      object,
      [usageDetails],
      `Langfuse observation ${index}`
    )
    const outputTokens = readRequiredNumber(
      object,
      [
        'outputUsage',
        'outputTokens',
        'completionTokens',
        'completion_tokens',
        'output',
      ],
      `Langfuse observation ${index}.outputTokens`,
      [usageDetails]
    )
    const model = readRequiredString(
      object,
      ['providedModelName', 'model', 'modelName'],
      `Langfuse observation ${index}.model`
    )

    addAggregate(
      aggregates,
      {
        model,
        generationCount: 1,
        ...buckets,
        outputTokens,
        totalCost,
      },
      `Langfuse observation ${index}`
    )
  }

  return {
    scope,
    rows: Array.from(aggregates.values()).sort(byModel),
    assistantResponseCount: null,
  }
}

function nestedPromptDetails(object: JsonObject) {
  const details = object.prompt_tokens_details
  return details && typeof details === 'object' && !Array.isArray(details)
    ? [details as JsonObject]
    : []
}

function assistantResponseId(object: JsonObject) {
  const rawMetadata = object.metadata
  let metadata: JsonObject | null = null
  if (
    rawMetadata &&
    typeof rawMetadata === 'object' &&
    !Array.isArray(rawMetadata)
  ) {
    metadata = rawMetadata as JsonObject
  } else if (typeof rawMetadata === 'string') {
    try {
      const parsed = JSON.parse(rawMetadata)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        metadata = parsed as JsonObject
      }
    } catch {
      metadata = null
    }
  }

  const candidates = [
    object.session_id,
    object.sessionId,
    metadata?.session_id,
    metadata?.sessionId,
  ]
  return candidates.find(
    (value): value is string => typeof value === 'string' && value.length > 0
  )
}

export function aggregateLiteLLMSpend(
  payload: unknown,
  scope: AggregateScope
): CostLedger {
  const rows = asArray(payload, 'LiteLLM spend')
  const aggregates = new Map<string, CostAggregate>()
  const responseIds = new Set<string>()
  let missingResponseId = false

  for (const [index, value] of rows.entries()) {
    const object = asObject(value, `LiteLLM spend row ${index}`)
    if (String(object.team_id ?? '') !== scope.teamId) continue

    const totalCost = readRequiredNumber(
      object,
      ['spend', 'totalCost', 'total_cost'],
      `LiteLLM spend row ${index}.totalCost`
    )
    if (totalCost <= 0) continue

    const responseId = assistantResponseId(object)
    if (responseId) responseIds.add(responseId)
    else missingResponseId = true

    const buckets = inputBuckets(
      object,
      nestedPromptDetails(object),
      `LiteLLM spend row ${index}`
    )
    const outputTokens = readRequiredNumber(
      object,
      [
        'completion_tokens',
        'completionTokens',
        'output_tokens',
        'outputTokens',
      ],
      `LiteLLM spend row ${index}.outputTokens`
    )
    const model = readRequiredString(
      object,
      ['model', 'model_name', 'modelName'],
      `LiteLLM spend row ${index}.model`
    )

    addAggregate(
      aggregates,
      {
        model,
        generationCount: 1,
        ...buckets,
        outputTokens,
        totalCost,
      },
      `LiteLLM spend row ${index}`
    )
  }

  return {
    scope,
    rows: Array.from(aggregates.values()).sort(byModel),
    assistantResponseCount: missingResponseId ? null : responseIds.size,
  }
}

function byModel(left: CostAggregate, right: CostAggregate) {
  return left.model.localeCompare(right.model)
}

function sameScope(left: AggregateScope, right: AggregateScope) {
  return (
    left.from === right.from &&
    left.to === right.to &&
    left.environment === right.environment &&
    left.teamId === right.teamId
  )
}

export function summarizeCostLedger(ledger: CostLedger): CostSummary {
  const totals = ledger.rows.reduce(
    (summary, row) => ({
      generationCount: summary.generationCount + row.generationCount,
      inputTokens: summary.inputTokens + row.inputTokens,
      uncachedInputTokens:
        summary.uncachedInputTokens + row.uncachedInputTokens,
      cacheReadInputTokens:
        summary.cacheReadInputTokens + row.cacheReadInputTokens,
      cacheWriteInputTokens:
        summary.cacheWriteInputTokens + row.cacheWriteInputTokens,
      outputTokens: summary.outputTokens + row.outputTokens,
      totalCost: summary.totalCost + row.totalCost,
    }),
    {
      generationCount: 0,
      inputTokens: 0,
      uncachedInputTokens: 0,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
    }
  )

  const assistantResponseCount = ledger.assistantResponseCount

  return {
    ...totals,
    assistantResponseCount,
    cacheReadRate:
      totals.inputTokens > 0
        ? totals.cacheReadInputTokens / totals.inputTokens
        : null,
    averageCostPerGeneration:
      totals.generationCount > 0
        ? totals.totalCost / totals.generationCount
        : null,
    averageCostPerAssistantResponse:
      assistantResponseCount !== null && assistantResponseCount > 0
        ? totals.totalCost / assistantResponseCount
        : null,
    modelDistribution: ledger.rows.map((row) => ({
      model: row.model,
      generationCount: row.generationCount,
      share:
        totals.generationCount > 0
          ? row.generationCount / totals.generationCount
          : 0,
      totalCost: row.totalCost,
    })),
  }
}

export function reconcileCostLedgers(
  langfuse: CostLedger,
  litellm: CostLedger,
  options: { absoluteTolerance: number; relativeTolerance: number }
): ReconciliationResult {
  const langfuseSummary = summarizeCostLedger(langfuse)
  const litellmSummary = summarizeCostLedger(litellm)
  const issues: string[] = []

  if (!sameScope(langfuse.scope, litellm.scope)) {
    issues.push('Langfuse and LiteLLM scopes differ')
  }

  const langfuseByModel = new Map(langfuse.rows.map((row) => [row.model, row]))
  const litellmByModel = new Map(litellm.rows.map((row) => [row.model, row]))
  const models = new Set([...langfuseByModel.keys(), ...litellmByModel.keys()])

  for (const model of Array.from(models).sort()) {
    const left = langfuseByModel.get(model)
    const right = litellmByModel.get(model)
    if (!left || !right) {
      issues.push(`model set differs at ${model}`)
      continue
    }

    if (left.generationCount !== right.generationCount) {
      issues.push(`generation count differs at ${model}`)
    }

    for (const field of [
      'inputTokens',
      'uncachedInputTokens',
      'cacheReadInputTokens',
      'cacheWriteInputTokens',
      'outputTokens',
    ] as const) {
      if (left[field] !== right[field]) {
        issues.push(`${field} differs at ${model}`)
      }
    }

    const absoluteDrift = Math.abs(left.totalCost - right.totalCost)
    const denominator = Math.max(left.totalCost, right.totalCost, 1e-12)
    if (
      absoluteDrift >
      Math.max(
        options.absoluteTolerance,
        denominator * options.relativeTolerance
      )
    ) {
      issues.push(`cost differs at ${model}`)
    }
  }

  return {
    status: issues.length === 0 ? 'reconciled' : 'mismatch',
    issues,
    langfuse: langfuseSummary,
    litellm: litellmSummary,
  }
}

export function incompleteCostResult(error: unknown): ReconciliationResult {
  return {
    status: 'incomplete',
    issues: [error instanceof Error ? error.message : String(error)],
    langfuse: null,
    litellm: null,
  }
}

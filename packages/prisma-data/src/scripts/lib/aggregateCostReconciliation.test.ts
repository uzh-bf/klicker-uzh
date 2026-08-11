import assert from 'node:assert/strict'
import {
  type AggregateScope,
  aggregateLangfuseObservations,
  aggregateLiteLLMSpend,
  type CostLedger,
  incompleteCostResult,
  reconcileCostLedgers,
  summarizeCostLedger,
} from './aggregateCostReconciliation.js'

const scope: AggregateScope = {
  from: '2026-08-01T00:00:00.000Z',
  to: '2026-08-08T00:00:00.000Z',
  environment: 'stg',
  teamId: 'team-aibuddy',
}

function langfuseObservation(overrides: Record<string, unknown> = {}) {
  return {
    type: 'GENERATION',
    providedModelName: 'aibuddy/azure/gpt-5.6-luna',
    usageDetails: {
      input: 100,
      output: 20,
      cache_read_input_tokens: 40,
      cache_creation_input_tokens: 10,
    },
    totalCost: 0.2,
    ...overrides,
  }
}

function litellmSpend(overrides: Record<string, unknown> = {}) {
  return {
    team_id: 'team-aibuddy',
    model: 'aibuddy/azure/gpt-5.6-luna',
    startTime: '2026-08-03T12:00:00.000Z',
    prompt_tokens: 100,
    completion_tokens: 20,
    prompt_tokens_details: {
      cached_tokens: 40,
      cache_creation_input_tokens: 10,
    },
    spend: 0.2,
    ...overrides,
  }
}

function matchingLedgers(): { langfuse: CostLedger; litellm: CostLedger } {
  return {
    langfuse: aggregateLangfuseObservations(
      [langfuseObservation(), langfuseObservation({ totalCost: 0 })],
      scope
    ),
    litellm: aggregateLiteLLMSpend([litellmSpend()], scope),
  }
}

function testMatchingLedgersReconcile() {
  const { langfuse, litellm } = matchingLedgers()
  const result = reconcileCostLedgers(langfuse, litellm, {
    absoluteTolerance: 0.000001,
    relativeTolerance: 0.001,
  })

  assert.equal(result.status, 'reconciled')
  assert.deepEqual(result.issues, [])
  assert.equal(result.langfuse?.generationCount, 1)
  assert.equal(result.langfuse?.cacheReadInputTokens, 40)
  assert.equal(result.langfuse?.cacheReadRate, 0.4)
  assert.equal(result.langfuse?.averageCostPerGeneration, 0.2)
  assert.deepEqual(result.litellm?.modelDistribution, [
    {
      model: 'aibuddy/azure/gpt-5.6-luna',
      generationCount: 1,
      inputTokens: 100,
      uncachedInputTokens: 50,
      cacheReadInputTokens: 40,
      cacheWriteInputTokens: 10,
      outputTokens: 20,
      share: 1,
      totalCost: 0.2,
    },
  ])
}

function testMissingCacheWriteIsIncomplete() {
  assert.throws(
    () =>
      aggregateLangfuseObservations(
        [
          langfuseObservation({
            usageDetails: {
              input: 100,
              output: 20,
              cache_read_input_tokens: 40,
            },
          }),
        ],
        scope
      ),
    /cacheWriteInputTokens is missing/
  )

  const result = incompleteCostResult(
    new Error('Langfuse cacheWriteInputTokens is missing')
  )
  assert.equal(result.status, 'incomplete')
  assert.deepEqual(result.issues, ['Langfuse cacheWriteInputTokens is missing'])
}

function testNegativeCacheAlgebraIsRejected() {
  assert.throws(
    () =>
      aggregateLangfuseObservations(
        [
          langfuseObservation({
            usageDetails: {
              input: 100,
              output: 20,
              cache_read_input_tokens: 110,
              cache_creation_input_tokens: 0,
            },
          }),
        ],
        scope
      ),
    /cache buckets exceed inclusive input tokens/
  )
}

function testExactWindowAndSourceScopeAreFailClosed() {
  const inWindow = aggregateLiteLLMSpend(
    [
      litellmSpend(),
      litellmSpend({ startTime: scope.to }),
      litellmSpend({ startTime: '2026-07-31T23:59:59.999Z' }),
    ],
    scope
  )
  assert.equal(inWindow.rows[0]?.generationCount, 1)

  assert.throws(
    () =>
      aggregateLiteLLMSpend([litellmSpend({ startTime: undefined })], scope),
    /startTime is missing/
  )
  assert.throws(
    () =>
      aggregateLiteLLMSpend([litellmSpend({ team_id: 'other-team' })], scope),
    /outside the requested team scope/
  )
  assert.throws(
    () =>
      aggregateLangfuseObservations(
        [langfuseObservation({ type: undefined })],
        scope
      ),
    /type must be GENERATION/
  )
}

function testModelSetCountCostAndScopeDriftAreNotReconciled() {
  const { langfuse, litellm } = matchingLedgers()
  const differentModel = aggregateLiteLLMSpend(
    [litellmSpend({ model: 'aibuddy/azure/gpt-5.6-sol' })],
    scope
  )
  const differentScope = {
    ...litellm,
    scope: { ...scope, teamId: 'other-team' },
  }

  assert.match(
    reconcileCostLedgers(langfuse, differentModel, {
      absoluteTolerance: 0.000001,
      relativeTolerance: 0.001,
    }).issues.join('|'),
    /model set differs/
  )

  const countDrift = {
    ...litellm,
    rows: litellm.rows.map((row) => ({ ...row, generationCount: 2 })),
  }
  assert.match(
    reconcileCostLedgers(langfuse, countDrift, {
      absoluteTolerance: 0.000001,
      relativeTolerance: 0.001,
    }).issues.join('|'),
    /generation count differs/
  )

  const costDrift = {
    ...litellm,
    rows: litellm.rows.map((row) => ({ ...row, totalCost: 0.3 })),
  }
  assert.match(
    reconcileCostLedgers(langfuse, costDrift, {
      absoluteTolerance: 0.000001,
      relativeTolerance: 0.001,
    }).issues.join('|'),
    /cost differs/
  )

  const tokenDrift = {
    ...litellm,
    rows: litellm.rows.map((row) => ({ ...row, outputTokens: 21 })),
  }
  assert.match(
    reconcileCostLedgers(langfuse, tokenDrift, {
      absoluteTolerance: 0.000001,
      relativeTolerance: 0.001,
    }).issues.join('|'),
    /outputTokens differs/
  )

  assert.match(
    reconcileCostLedgers(langfuse, differentScope, {
      absoluteTolerance: 0.000001,
      relativeTolerance: 0.001,
    }).issues.join('|'),
    /scopes differ/
  )
}

function testSummaryOfEmptyLedgerIsExplicit() {
  const summary = summarizeCostLedger({
    scope,
    rows: [],
  })
  assert.equal(summary.generationCount, 0)
  assert.equal(summary.cacheReadRate, null)
  assert.equal(summary.averageCostPerGeneration, null)
  assert.deepEqual(summary.modelDistribution, [])
}

function testInvalidTolerancesAreRejected() {
  const { langfuse, litellm } = matchingLedgers()
  assert.throws(
    () =>
      reconcileCostLedgers(langfuse, litellm, {
        absoluteTolerance: Number.NaN,
        relativeTolerance: 0.001,
      }),
    /absoluteTolerance must be a finite non-negative number/
  )
  assert.throws(
    () =>
      reconcileCostLedgers(langfuse, litellm, {
        absoluteTolerance: 0.000001,
        relativeTolerance: Number.POSITIVE_INFINITY,
      }),
    /relativeTolerance must be a finite non-negative number/
  )
}

testMatchingLedgersReconcile()
testMissingCacheWriteIsIncomplete()
testNegativeCacheAlgebraIsRejected()
testExactWindowAndSourceScopeAreFailClosed()
testModelSetCountCostAndScopeDriftAreNotReconciled()
testSummaryOfEmptyLedgerIsExplicit()
testInvalidTolerancesAreRejected()

console.log('aggregate cost reconciliation tests passed')

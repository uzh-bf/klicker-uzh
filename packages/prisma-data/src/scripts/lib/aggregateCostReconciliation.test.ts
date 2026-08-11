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
    prompt_tokens: 100,
    completion_tokens: 20,
    prompt_tokens_details: {
      cached_tokens: 40,
      cache_creation_input_tokens: 10,
    },
    metadata: { session_id: 'assistant-1' },
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
    litellm: aggregateLiteLLMSpend(
      [litellmSpend(), litellmSpend({ team_id: 'other-team', spend: 2 })],
      scope
    ),
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
  assert.equal(result.litellm?.assistantResponseCount, 1)
  assert.equal(result.litellm?.averageCostPerAssistantResponse, 0.2)
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
    assistantResponseCount: null,
  })
  assert.equal(summary.generationCount, 0)
  assert.equal(summary.cacheReadRate, null)
  assert.equal(summary.averageCostPerGeneration, null)
  assert.equal(summary.averageCostPerAssistantResponse, null)
  assert.deepEqual(summary.modelDistribution, [])
}

testMatchingLedgersReconcile()
testMissingCacheWriteIsIncomplete()
testNegativeCacheAlgebraIsRejected()
testModelSetCountCostAndScopeDriftAreNotReconciled()
testSummaryOfEmptyLedgerIsExplicit()

console.log('aggregate cost reconciliation tests passed')

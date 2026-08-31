const assert = require('node:assert/strict')
const test = require('node:test')

const { buildPlanMetadata } = require('./playwright-plan-metadata.cjs')

function plan(mode, shardCount = mode === 'skip' ? 0 : 1) {
  return {
    schemaVersion: 1,
    mode,
    shardCount,
    reasonCodes: [],
    shards: Array.from({ length: shardCount }, (_, index) => ({
      shardIndex: index + 1,
      shardTotal: shardCount,
      files: [`tests/spec-${index}.spec.ts`],
    })),
  }
}

test('metadata exposes one matrix for selected plans and no matrix for skips', () => {
  const selected = buildPlanMetadata(plan('selected', 2), {
    route: 'hosted',
    selectorPrState: 'draft',
  })
  assert.equal(selected.shouldRun, true)
  assert.deepEqual(selected.shardMatrix, {
    include: [
      { shardIndex: 1, shardTotal: 2 },
      { shardIndex: 2, shardTotal: 2 },
    ],
  })

  const skipped = buildPlanMetadata(plan('skip'), {
    route: 'hosted',
    selectorPrState: 'draft',
  })
  assert.equal(skipped.shouldRun, false)
  assert.deepEqual(skipped.shardMatrix, { include: [] })
})

test('ready execution fails closed unless the plan is full', () => {
  assert.throws(
    () =>
      buildPlanMetadata(plan('selected'), {
        route: 'public-pr',
        selectorPrState: 'ready',
      }),
    /ready execution must use the full/
  )
})

test('ready execution fails closed unless the full plan has eight shards', () => {
  assert.throws(
    () =>
      buildPlanMetadata(plan('full', 4), {
        route: 'public-pr',
        selectorPrState: 'ready',
      }),
    /exactly eight/
  )
})

test('invalid shard metadata fails closed', () => {
  const invalid = plan('full', 8)
  invalid.shards[0].files = []
  assert.throws(
    () =>
      buildPlanMetadata(invalid, {
        route: 'hosted',
        selectorPrState: 'ready',
      }),
    /invalid shard/
  )
})

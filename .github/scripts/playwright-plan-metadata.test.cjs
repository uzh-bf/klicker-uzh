const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  buildPlanMetadata,
  writeGithubOutputs,
} = require('./playwright-plan-metadata.cjs')

function plan(
  mode,
  shardCount = mode === 'skip' ? 0 : 1,
  envelopeClass = 'application'
) {
  return {
    schemaVersion: 1,
    mode,
    envelopeClass,
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

test('a bounded change class may narrow the ready plan it attests', () => {
  const documented = buildPlanMetadata(
    plan('skip', 0, 'documentation-and-planning'),
    {
      route: 'hosted',
      selectorPrState: 'ready',
    }
  )
  assert.equal(documented.mode, 'skip')
  assert.equal(documented.envelopeClass, 'documentation-and-planning')
  assert.equal(documented.shouldRun, false)

  const ci = buildPlanMetadata(plan('selected', 1, 'ci-orchestration'), {
    route: 'public-pr',
    selectorPrState: 'ready',
  })
  assert.equal(ci.mode, 'selected')
  assert.equal(ci.envelopeClass, 'ci-orchestration')
  assert.equal(ci.shouldRun, true)
})

test('an unknown or absent change class fails closed', () => {
  const absent = plan('selected', 1)
  // delete, because an explicit undefined argument would take the fixture
  // default and silently exercise the application class instead.
  delete absent.envelopeClass
  for (const candidate of [absent, null, '', 'narrow', 'constructor']) {
    const target =
      candidate && typeof candidate === 'object'
        ? candidate
        : plan('selected', 1, candidate)
    assert.throws(
      () =>
        buildPlanMetadata(target, {
          route: 'hosted',
          selectorPrState: 'ready',
        }),
      /unsupported change class/,
      String(candidate)
    )
  }
})

test('the envelope class travels through the workflow output', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-metadata-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const output = path.join(directory, 'outputs.txt')
  fs.writeFileSync(output, '')
  writeGithubOutputs(
    buildPlanMetadata(plan('selected', 1, 'ci-orchestration'), {
      route: 'public-pr',
      selectorPrState: 'ready',
    }),
    output
  )
  assert.match(
    fs.readFileSync(output, 'utf8'),
    /^envelope_class=ci-orchestration$/m
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

test('valid full ready execution exposes all eight matrix entries', () => {
  const metadata = buildPlanMetadata(plan('full', 8), {
    route: 'public-pr',
    selectorPrState: 'ready',
  })

  assert.equal(metadata.shouldRun, true)
  assert.equal(metadata.shardMatrix.include.length, 8)
  assert.deepEqual(
    metadata.shardMatrix.include,
    Array.from({ length: 8 }, (_, index) => ({
      shardIndex: index + 1,
      shardTotal: 8,
    }))
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

test('duplicate shard indices and unsafe reason codes fail closed', () => {
  const duplicate = plan('full', 8)
  duplicate.shards[1].shardIndex = 1
  assert.throws(
    () =>
      buildPlanMetadata(duplicate, {
        route: 'hosted',
        selectorPrState: 'ready',
      }),
    /duplicate shard indices/
  )

  const unsafeReason = plan('selected', 1)
  unsafeReason.reasonCodes = ['ok\nforged=value']
  assert.throws(
    () =>
      buildPlanMetadata(unsafeReason, {
        route: 'hosted',
        selectorPrState: 'draft',
      }),
    /reason codes/
  )
})

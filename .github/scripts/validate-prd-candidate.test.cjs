const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const test = require('node:test')
const { validateProductionCandidate } = require('./validate-prd-candidate.cjs')
function fixture(overrides = {}) {
  const receipt = {
    sourceBranch: 'v3-ai',
    sourceSha: 'a'.repeat(40),
    configurationSha256: 'b'.repeat(64),
    migrationInventorySha256: 'c'.repeat(64),
    capabilityStateSha256: 'd'.repeat(64),
    artifacts: [
      {
        workload: 'backend',
        image: `ghcr.io/uzh-bf/klicker-uzh/backend-docker-arm@sha256:${'e'.repeat(64)}`,
      },
      {
        workload: 'migrator',
        image: `ghcr.io/uzh-bf/klicker-uzh/backend-docker-migrator-arm@sha256:${'f'.repeat(64)}`,
      },
    ],
    ...overrides,
  }
  const receiptBytes = Buffer.from(JSON.stringify(receipt))
  return {
    expectedWorkloads: ['backend', 'migrator'],
    candidateSha: 'a'.repeat(40),
    approvedSha: 'a'.repeat(40),
    receiptBytes,
    approvedReceiptSha256: createHash('sha256')
      .update(receiptBytes)
      .digest('hex'),
  }
}
test('accepts only the exact independently selected maintenance receipt', () => {
  assert.equal(validateProductionCandidate(fixture()).sourceSha, 'a'.repeat(40))
})
test('rejects missing approval and different descendants even with a release tag', () => {
  assert.throws(() =>
    validateProductionCandidate({ ...fixture(), approvedSha: undefined })
  )
  assert.throws(() =>
    validateProductionCandidate({ ...fixture(), candidateSha: '9'.repeat(40) })
  )
  assert.throws(() =>
    validateProductionCandidate({
      ...fixture(),
      approvedReceiptSha256: undefined,
    })
  )
})
test('rejects stable and audit source receipts', () => {
  for (const sourceBranch of ['v3', 'v3-audit'])
    assert.throws(() => validateProductionCandidate(fixture({ sourceBranch })))
})
test('rejects changed configuration, missing migrator and mutable image tags', () => {
  const input = fixture()
  assert.throws(() =>
    validateProductionCandidate({
      ...input,
      receiptBytes: Buffer.from(
        input.receiptBytes.toString().replace('configurationSha256', 'changed')
      ),
    })
  )
  assert.throws(() =>
    validateProductionCandidate(fixture({ migrationInventorySha256: '' }))
  )
  assert.throws(() =>
    validateProductionCandidate(
      fixture({
        artifacts: [
          {
            workload: 'backend',
            image: 'ghcr.io/uzh-bf/klicker-uzh/backend-docker-arm:v3.4.0',
          },
        ],
      })
    )
  )
})

test('rejects an arbitrary artifact in place of the backend application', () => {
  const input = fixture()
  const receipt = JSON.parse(input.receiptBytes)
  receipt.artifacts[0].workload = 'unrelated'
  assert.throws(() => validateProductionCandidate(fixture(receipt)))
})

test('requires an independent complete workload inventory', () => {
  assert.throws(() => validateProductionCandidate({
    ...fixture(), expectedWorkloads: undefined,
  }))
  assert.throws(() => validateProductionCandidate({
    ...fixture(), expectedWorkloads: ['backend', 'migrator', 'chat'],
  }))
  assert.throws(() => validateProductionCandidate({
    ...fixture(), expectedWorkloads: ['backend', 'migrator', 'migrator'],
  }))
  const receipt = JSON.parse(fixture().receiptBytes)
  receipt.artifacts.push({
    workload: 'unexpected',
    image: `ghcr.io/uzh-bf/klicker-uzh/chat-arm@sha256:${'e'.repeat(64)}`,
  })
  assert.throws(() => validateProductionCandidate(fixture(receipt)))
})

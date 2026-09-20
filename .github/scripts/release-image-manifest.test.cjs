const assert = require('node:assert/strict')
const test = require('node:test')

const {
  SCHEMA_VERSION,
  assertReleaseManifest,
  buildReleaseManifest,
  formatManifestSummary,
  validateReleaseManifest,
} = require('./release-image-manifest.cjs')

const CANDIDATE = 'a'.repeat(40)
const REUSE_SOURCE = 'b'.repeat(40)
const DIGEST = 'sha256:' + '1'.repeat(64)
const OTHER_DIGEST = 'sha256:' + '2'.repeat(64)
const FINGERPRINT = 'sha256:' + '3'.repeat(64)
const OTHER_FINGERPRINT = 'sha256:' + '9'.repeat(64)

function entry(targetId, overrides = {}) {
  return {
    architecture: 'linux/arm64',
    digest: DIGEST,
    fingerprint: FINGERPRINT,
    image: 'ghcr.io/uzh-bf/klicker-uzh/' + targetId + '@' + DIGEST,
    receipts: [
      { digest: DIGEST, kind: 'image-scan', path: 'image-scan-' + targetId },
    ],
    reusedFrom: null,
    sourceSha: CANDIDATE,
    targetId,
    ...overrides,
  }
}

function reused(targetId, overrides = {}) {
  return entry(targetId, {
    reusedFrom: {
      digest: DIGEST,
      fingerprint: FINGERPRINT,
      sourceSha: REUSE_SOURCE,
      tag: 'fp-' + OTHER_FINGERPRINT.slice(7),
      ...overrides,
    },
  })
}

// A target whose build inputs cannot be reused carries neither a fingerprint
// nor a scan receipt, because the publication produces neither.
function unscanned(targetId, overrides = {}) {
  return entry(targetId, { fingerprint: null, receipts: [], ...overrides })
}

function manifest(entries) {
  return buildReleaseManifest({
    candidateSha: CANDIDATE,
    createdAt: '2026-09-20T12:00:00.000Z',
    entries,
    sourceBranch: 'v3-audit',
  })
}

function codes(result) {
  return result.errors.map((item) => item.code)
}

test('a release that reuses one component and rebuilds another is admissible', () => {
  const input = manifest([
    reused('hatchet-worker-general-arm'),
    entry('backend-docker-arm'),
  ])
  assert.equal(input.schemaVersion, SCHEMA_VERSION)
  // Entries are sorted, so the same release always serializes identically.
  assert.deepEqual(
    input.entries.map((item) => item.targetId),
    ['backend-docker-arm', 'hatchet-worker-general-arm']
  )
  const result = validateReleaseManifest({
    expectedTargetIds: ['backend-docker-arm', 'hatchet-worker-general-arm'],
    isAncestor: (sha) => sha === REUSE_SOURCE,
    manifest: input,
    reuseEligibleIds: ['backend-docker-arm', 'hatchet-worker-general-arm'],
    resolvedDigests: new Map([
      ['backend-docker-arm', DIGEST],
      ['hatchet-worker-general-arm', DIGEST],
    ]),
  })
  assert.deepEqual(result.errors, [])
  assert.equal(result.ok, true)
  assert.deepEqual(result.reused, ['hatchet-worker-general-arm'])
  assert.deepEqual(result.rebuilt, ['backend-docker-arm'])
  assert.match(
    formatManifestSummary(input, result),
    /- Reused: hatchet-worker-general-arm/
  )
})

test('an incomplete or ambiguous release is rejected', () => {
  const missing = validateReleaseManifest({
    expectedTargetIds: ['backend-docker-arm', 'response-api-arm'],
    manifest: manifest([entry('backend-docker-arm')]),
    reuseEligibleIds: ['backend-docker-arm', 'response-api-arm'],
  })
  assert.deepEqual(codes(missing), ['missing-target'])
  assert.equal(missing.errors[0].targetId, 'response-api-arm')

  const duplicate = validateReleaseManifest({
    expectedTargetIds: ['backend-docker-arm'],
    manifest: manifest([
      entry('backend-docker-arm'),
      entry('backend-docker-arm'),
    ]),
    reuseEligibleIds: ['backend-docker-arm'],
  })
  assert.deepEqual(codes(duplicate), ['duplicate-target'])

  const unexpected = validateReleaseManifest({
    expectedTargetIds: ['backend-docker-arm'],
    manifest: manifest([entry('backend-docker-arm'), entry('mcp-student-arm')]),
    reuseEligibleIds: ['backend-docker-arm', 'mcp-student-arm'],
  })
  assert.deepEqual(codes(unexpected), ['unexpected-target'])

  const unavailable = validateReleaseManifest({
    expectedTargetIds: ['backend-docker-arm', 'mcp-student-arm'],
    manifest: manifest([entry('backend-docker-arm'), entry('mcp-student-arm')]),
    reuseEligibleIds: ['backend-docker-arm', 'mcp-student-arm'],
    unavailableTargetIds: ['mcp-student-arm'],
  })
  assert.deepEqual(codes(unavailable), ['unavailable-target'])

  const noEntries = validateReleaseManifest({
    manifest: { schemaVersion: SCHEMA_VERSION },
  })
  assert.ok(codes(noEntries).includes('entries'))
  assert.equal(noEntries.ok, false)
})

test('a reused frontend image is a release violation', () => {
  const frontend = reused('frontend-manage-arm')
  const input = {
    expectedTargetIds: ['frontend-manage-arm'],
    isAncestor: () => true,
    manifest: manifest([frontend]),
    // The inventory excludes Next.js images, because their build arguments are
    // frozen into the browser bundle at build time.
    reuseEligibleIds: ['backend-docker-arm'],
  }
  const result = validateReleaseManifest(input)
  // The hostile entry claims both a fingerprint and a reuse the inventory
  // cannot grant for a Next.js image.
  assert.deepEqual(codes(result), [
    'unexpected-fingerprint',
    'reuse-not-eligible',
  ])
  assert.throws(
    () => assertReleaseManifest(input),
    /frontend-manage-arm:reuse-not-eligible/
  )
})

test('a target that cannot carry a fingerprint or a scan receipt may not claim one', () => {
  const claimedFingerprint = validateReleaseManifest({
    expectedTargetIds: ['frontend-manage-arm'],
    manifest: manifest([entry('frontend-manage-arm')]),
    reuseEligibleIds: ['backend-docker-arm'],
  })
  assert.deepEqual(codes(claimedFingerprint), ['unexpected-fingerprint'])

  const claimedReceipt = validateReleaseManifest({
    expectedTargetIds: ['frontend-manage-arm'],
    manifest: manifest([unscanned('frontend-manage-arm')]),
    reuseEligibleIds: ['backend-docker-arm'],
    // The inventory scans only the targets it publishes a receipt for.
    scannedTargetIds: [],
  })
  assert.deepEqual(codes(claimedReceipt), [])

  const soundUnscanned = validateReleaseManifest({
    expectedTargetIds: ['frontend-manage-arm'],
    manifest: manifest([
      unscanned('frontend-manage-arm', {
        receipts: [{ digest: DIGEST, kind: 'image-scan' }],
      }),
    ]),
    reuseEligibleIds: ['backend-docker-arm'],
    scannedTargetIds: [],
  })
  assert.deepEqual(codes(soundUnscanned), ['unexpected-receipt'])

  // Forgetting the scanned inventory expects a receipt everywhere.
  const forgottenInventory = validateReleaseManifest({
    expectedTargetIds: ['frontend-manage-arm'],
    manifest: manifest([unscanned('frontend-manage-arm')]),
    reuseEligibleIds: ['backend-docker-arm'],
  })
  assert.deepEqual(codes(forgottenInventory), ['missing-receipt'])
})

test('a reuse with different inputs, a different digest, or no provenance is rejected', () => {
  const validate = (overrides) =>
    validateReleaseManifest({
      expectedTargetIds: ['backend-docker-arm'],
      isAncestor: () => true,
      manifest: manifest([reused('backend-docker-arm', overrides)]),
      reuseEligibleIds: ['backend-docker-arm'],
    })
  assert.deepEqual(codes(validate({ fingerprint: OTHER_FINGERPRINT })), [
    'reuse-fingerprint',
  ])
  assert.deepEqual(codes(validate({ digest: OTHER_DIGEST })), ['reuse-digest'])
  assert.deepEqual(codes(validate({ sourceSha: 'abc' })), ['reuse-provenance'])
  assert.deepEqual(codes(validate({ tag: '' })), ['reuse-provenance'])
})

test('reuse from a revision that is not an ancestor of the candidate is rejected', () => {
  const result = validateReleaseManifest({
    expectedTargetIds: ['backend-docker-arm'],
    isAncestor: () => false,
    manifest: manifest([reused('backend-docker-arm')]),
    reuseEligibleIds: ['backend-docker-arm'],
  })
  assert.deepEqual(codes(result), ['reuse-ancestry'])
})

test('a reuse that omits a target is rejected even when every entry is sound', () => {
  const result = validateReleaseManifest({
    expectedTargetIds: ['backend-docker-arm', 'response-api-arm'],
    isAncestor: () => true,
    manifest: manifest([reused('backend-docker-arm')]),
    reuseEligibleIds: ['backend-docker-arm', 'response-api-arm'],
  })
  assert.deepEqual(codes(result).sort(), ['incomplete-reuse', 'missing-target'])
})

test('an entry without qualification evidence for its own digest is rejected', () => {
  const withoutReceipts = validateReleaseManifest({
    expectedTargetIds: ['backend-docker-arm'],
    manifest: manifest([entry('backend-docker-arm', { receipts: [] })]),
    reuseEligibleIds: ['backend-docker-arm'],
  })
  assert.deepEqual(codes(withoutReceipts), ['missing-receipt'])

  const otherDigest = validateReleaseManifest({
    expectedTargetIds: ['backend-docker-arm'],
    manifest: manifest([
      entry('backend-docker-arm', {
        receipts: [{ digest: OTHER_DIGEST, kind: 'image-scan' }],
      }),
    ]),
    reuseEligibleIds: ['backend-docker-arm'],
  })
  assert.deepEqual(codes(otherDigest), ['receipt-digest'])
})

test('an entry that disagrees with the published registry digest is rejected', () => {
  const result = validateReleaseManifest({
    expectedTargetIds: ['backend-docker-arm'],
    manifest: manifest([entry('backend-docker-arm')]),
    resolvedDigests: new Map([['backend-docker-arm', OTHER_DIGEST]]),
    reuseEligibleIds: ['backend-docker-arm'],
  })
  assert.deepEqual(codes(result), ['digest-mismatch'])
})

test('entry fields that cannot be promoted are rejected', () => {
  const result = validateReleaseManifest({
    expectedTargetIds: ['backend-docker-arm'],
    manifest: manifest([
      entry('backend-docker-arm', {
        architecture: '',
        digest: 'sha256:short',
        fingerprint: 'not-a-fingerprint',
        image: 'ghcr.io/uzh-bf/klicker-uzh/backend-docker:latest',
        sourceSha: 'unknown',
      }),
    ]),
    reuseEligibleIds: ['backend-docker-arm'],
  })
  assert.deepEqual(codes(result).sort(), [
    'architecture',
    'digest',
    'fingerprint',
    'image-pin',
    // The receipt still describes the real digest, which the malformed entry
    // digest cannot match.
    'receipt-digest',
    'source-sha',
  ])
})

test('a manifest from another schema or with unreadable metadata is rejected', () => {
  const result = validateReleaseManifest({
    expectedTargetIds: [],
    manifest: {
      candidateSha: 'nope',
      createdAt: 'not-a-date',
      entries: [],
      schemaVersion: 'klicker.release-image-manifest/v0',
    },
  })
  assert.deepEqual(codes(result).sort(), [
    'candidate-sha',
    'created-at',
    'schema-version',
  ])
  assert.throws(
    () => assertReleaseManifest({ expectedTargetIds: [], manifest: {} }),
    /release manifest rejected/
  )
})

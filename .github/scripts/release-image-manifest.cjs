'use strict'

// Complete release image manifest for priority R3 of the CI efficiency roadmap.
//
// A release that adopts an already-qualified image instead of rebuilding it has
// to say so, and it has to say it for every target it publishes. This module
// owns that record and the rules that decide whether the record is admissible:
//
// - every expected target appears exactly once, so a reused release can never
//   quietly drop a component;
// - every entry names the source SHA, the immutable digest and the
//   architecture, plus the canonical input fingerprint and the qualification
//   receipts the trusted inventory can actually produce for that target: a
//   reuse-capable target has an input fingerprint, a scanned target has a scan
//   receipt, and a release that presents either for a target that cannot have
//   it is lying about its evidence;
// - a reused entry may only reference a target the inventory marks reusable,
//   and only with the same fingerprint and the same digest it claims to have
//   taken from the earlier publication, from a source revision the caller has
//   already proven to be an ancestor of the candidate.
//
// The rules are pure: the caller supplies the trusted inventory, the digests it
// resolved from the registry, and the ancestry it proved. That keeps the module
// testable without a registry or a run, and keeps the fail-closed decision in
// one place instead of spreading it across the workflow.

const SCHEMA_VERSION = 'klicker.release-image-manifest/v1'
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/
const SHA_PATTERN = /^[0-9a-f]{40}$/

// Which qualification a reused or rebuilt digest has to carry. Only the targets
// the trusted inventory marks scanned publish a scan receipt, so both shapes
// present one exactly there.
const REQUIRED_RECEIPT_KIND = 'image-scan'

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildReleaseManifest({
  candidateSha,
  createdAt = new Date().toISOString(),
  entries,
  sourceBranch,
}) {
  if (!Array.isArray(entries)) {
    throw new Error('release-image-manifest: entries must be an array')
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    candidateSha,
    createdAt,
    sourceBranch,
    entries: [...entries].sort((left, right) =>
      text(left?.targetId).localeCompare(text(right?.targetId))
    ),
  }
}

function error(code, targetId, message) {
  return { code, message, targetId: targetId ?? null }
}

function validateEntry({
  entry,
  errors,
  isAncestor,
  reuseEligibleIds,
  resolvedDigests,
  scannedIds,
}) {
  const targetId = text(entry?.targetId)
  const digest = text(entry?.digest)
  const fingerprint = text(entry?.fingerprint)
  if (!DIGEST_PATTERN.test(digest)) {
    errors.push(
      error('digest', targetId, 'entry has no immutable image digest')
    )
  }
  if (!text(entry?.image).endsWith(`@${digest}`)) {
    errors.push(
      error('image-pin', targetId, 'image is not pinned to the entry digest')
    )
  }
  if (!text(entry?.architecture)) {
    errors.push(error('architecture', targetId, 'entry has no architecture'))
  }
  if (!SHA_PATTERN.test(text(entry?.sourceSha))) {
    errors.push(
      error(
        'source-sha',
        targetId,
        'entry names no source commit for its image'
      )
    )
  }
  // A target the inventory cannot fingerprint (a Next.js image whose build
  // arguments are frozen into the bundle) must not claim one either.
  if (reuseEligibleIds.has(targetId) && !DIGEST_PATTERN.test(fingerprint)) {
    errors.push(
      error('fingerprint', targetId, 'entry has no canonical input fingerprint')
    )
  }
  if (!reuseEligibleIds.has(targetId) && fingerprint !== '') {
    errors.push(
      error(
        'unexpected-fingerprint',
        targetId,
        'target is not fingerprinted because its build inputs are not reusable'
      )
    )
  }
  const expectedDigest = resolvedDigests?.get(targetId)
  if (expectedDigest && expectedDigest !== digest) {
    errors.push(
      error(
        'digest-mismatch',
        targetId,
        `entry digest does not match the published digest ${expectedDigest}`
      )
    )
  }
  const receipts = Array.isArray(entry?.receipts) ? entry.receipts : []
  const scanReceipts = receipts.filter(
    (receipt) => text(receipt?.kind) === REQUIRED_RECEIPT_KIND
  )
  if (!scannedIds.has(targetId) && scanReceipts.length > 0) {
    errors.push(
      error(
        'unexpected-receipt',
        targetId,
        'target carries a scan receipt the publication cannot produce'
      )
    )
  } else if (scanReceipts.length === 0 && scannedIds.has(targetId)) {
    errors.push(
      error(
        'missing-receipt',
        targetId,
        `entry carries no ${REQUIRED_RECEIPT_KIND} receipt`
      )
    )
  } else if (
    scanReceipts.length > 0 &&
    scanReceipts.every((receipt) => {
      const bound = text(receipt?.digest)
      return bound !== '' && bound !== digest
    })
  ) {
    errors.push(
      error(
        'receipt-digest',
        targetId,
        'receipts describe a different digest than the entry'
      )
    )
  }
  const reusedFrom = entry?.reusedFrom
  if (reusedFrom === null || reusedFrom === undefined) return
  if (!reuseEligibleIds.has(targetId)) {
    errors.push(
      error(
        'reuse-not-eligible',
        targetId,
        'target may not be reused because its image carries build-time environment values'
      )
    )
  }
  if (text(reusedFrom.fingerprint) !== fingerprint) {
    errors.push(
      error(
        'reuse-fingerprint',
        targetId,
        'reused image was built from different inputs than this release describes'
      )
    )
  }
  if (text(reusedFrom.digest) !== digest) {
    errors.push(
      error(
        'reuse-digest',
        targetId,
        'reused image digest differs from the promoted digest'
      )
    )
  }
  const reuseSha = text(reusedFrom.sourceSha)
  if (!SHA_PATTERN.test(reuseSha)) {
    errors.push(
      error(
        'reuse-provenance',
        targetId,
        'reuse does not name its source commit'
      )
    )
  }
  if (text(reusedFrom.tag) === '') {
    errors.push(
      error('reuse-provenance', targetId, 'reuse does not name the adopted tag')
    )
  }
  if (typeof isAncestor === 'function' && SHA_PATTERN.test(reuseSha)) {
    if (isAncestor(reuseSha) !== true) {
      errors.push(
        error(
          'reuse-ancestry',
          targetId,
          `reuse source ${reuseSha} is not a proven ancestor of the candidate`
        )
      )
    }
  }
}

// Returns every violation instead of the first one, because a rejected release
// has to be explainable in one pass. `ok` stays the decision the caller acts on.
function validateReleaseManifest({
  manifest,
  expectedTargetIds = [],
  isAncestor,
  reuseEligibleIds = [],
  resolvedDigests,
  scannedTargetIds = null,
  unavailableTargetIds = [],
}) {
  const errors = []
  if (text(manifest?.schemaVersion) !== SCHEMA_VERSION) {
    errors.push(
      error('schema-version', null, `manifest schema must be ${SCHEMA_VERSION}`)
    )
  }
  if (!SHA_PATTERN.test(text(manifest?.candidateSha))) {
    errors.push(
      error('candidate-sha', null, 'manifest names no candidate commit')
    )
  }
  if (Number.isNaN(Date.parse(text(manifest?.createdAt)))) {
    errors.push(error('created-at', null, 'manifest has no readable timestamp'))
  }
  const entries = Array.isArray(manifest?.entries) ? manifest.entries : null
  if (entries === null) {
    errors.push(error('entries', null, 'manifest has no entry list'))
    return { entries: [], errors, ok: false, rebuilt: [], reused: [] }
  }
  const eligible = new Set(reuseEligibleIds)
  const unavailable = new Set(unavailableTargetIds)
  const expected = expectedTargetIds.filter((id) => !unavailable.has(id))
  // A caller that does not name the scanned targets is treated as expecting a
  // receipt everywhere, so forgetting the inventory fails closed.
  const scanned = new Set(scannedTargetIds ?? expected)
  const seen = new Map()
  for (const entry of entries) {
    const targetId = text(entry?.targetId)
    if (targetId === '') {
      errors.push(error('target-id', null, 'entry names no target'))
      continue
    }
    if (seen.has(targetId)) {
      errors.push(
        error('duplicate-target', targetId, 'target appears more than once')
      )
      continue
    }
    seen.set(targetId, entry)
    if (unavailable.has(targetId)) {
      errors.push(
        error(
          'unavailable-target',
          targetId,
          'target is unavailable on this branch and must not be published'
        )
      )
      continue
    }
    if (expected.length > 0 && !expected.includes(targetId)) {
      errors.push(
        error(
          'unexpected-target',
          targetId,
          'target is not part of this release'
        )
      )
      continue
    }
    validateEntry({
      entry,
      errors,
      isAncestor,
      reuseEligibleIds: eligible,
      resolvedDigests,
      scannedIds: scanned,
    })
  }
  for (const targetId of expected) {
    if (!seen.has(targetId)) {
      errors.push(
        error(
          'missing-target',
          targetId,
          'release has no image for this target'
        )
      )
    }
  }
  const reused = entries
    .filter((entry) => entry?.reusedFrom)
    .map((entry) => text(entry.targetId))
    .sort()
  const rebuilt = entries
    .filter((entry) => !entry?.reusedFrom)
    .map((entry) => text(entry.targetId))
    .sort()
  if (reused.length > 0 && seen.size !== expected.length) {
    errors.push(
      error(
        'incomplete-reuse',
        null,
        'a release that reuses an image must describe every target it publishes'
      )
    )
  }
  return { entries, errors, ok: errors.length === 0, rebuilt, reused }
}

function assertReleaseManifest(input) {
  const result = validateReleaseManifest(input)
  if (!result.ok) {
    const summary = result.errors
      .slice(0, 5)
      .map((item) =>
        item.targetId ? `${item.targetId}:${item.code}` : item.code
      )
      .join(', ')
    throw new Error(
      `release manifest rejected with ${result.errors.length} violation(s): ${summary}`
    )
  }
  return result
}

function formatManifestSummary(manifest, result) {
  return [
    '### Release image manifest',
    '',
    `- Schema: \`${text(manifest?.schemaVersion)}\``,
    `- Candidate: \`${text(manifest?.candidateSha)}\``,
    `- Targets: ${manifest?.entries?.length ?? 0}`,
    `- Rebuilt: ${result.rebuilt.join(', ') || 'none'}`,
    `- Reused: ${result.reused.join(', ') || 'none'}`,
    `- Violations: ${result.errors.length}`,
    '',
  ].join('\n')
}

module.exports = {
  REQUIRED_RECEIPT_KIND,
  SCHEMA_VERSION,
  assertReleaseManifest,
  buildReleaseManifest,
  formatManifestSummary,
  validateReleaseManifest,
}

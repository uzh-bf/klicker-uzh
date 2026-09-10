const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const fs = require('node:fs')

// Approval comes from the operator's independent receipt selection, never from
// candidate ancestry, a tag pattern, or a field that the candidate approves itself.
function validateProductionCandidate({
  candidateSha,
  approvedSha,
  receiptBytes,
  approvedReceiptSha256,
}) {
  assert.match(
    approvedSha || '',
    /^[a-f0-9]{40}$/,
    'an exact approved maintenance SHA is required'
  )
  assert.equal(
    candidateSha,
    approvedSha,
    'candidate differs from the approved maintenance snapshot'
  )
  assert.match(
    approvedReceiptSha256 || '',
    /^[a-f0-9]{64}$/,
    'an independently approved receipt hash is required'
  )
  assert.equal(
    createHash('sha256').update(receiptBytes).digest('hex'),
    approvedReceiptSha256,
    'receipt differs from operator approval'
  )
  const receipt = JSON.parse(receiptBytes)
  assert.equal(
    receipt.sourceBranch,
    'v3-ai',
    'production candidates must come from maintenance'
  )
  assert.equal(
    receipt.sourceSha,
    candidateSha,
    'receipt source differs from candidate'
  )
  for (const key of [
    'configurationSha256',
    'migrationInventorySha256',
    'capabilityStateSha256',
  ]) {
    assert.match(
      receipt[key] || '',
      /^[a-f0-9]{64}$/,
      `${key} must bind the reviewed state`
    )
  }
  assert.ok(
    Array.isArray(receipt.artifacts) && receipt.artifacts.length > 1,
    'application and migrator artifact identities are required'
  )
  const names = new Set()
  for (const artifact of receipt.artifacts) {
    assert.ok(
      typeof artifact.workload === 'string' && artifact.workload.length > 0,
      'workload identity is required'
    )
    assert.ok(!names.has(artifact.workload), 'duplicate workload identity')
    names.add(artifact.workload)
    assert.match(
      artifact.image || '',
      /^ghcr\.io\/uzh-bf\/klicker-uzh\/[a-z0-9-]+@sha256:[a-f0-9]{64}$/,
      'artifact must be pinned by digest'
    )
  }
  assert.ok(names.has('migrator'), 'migrator digest is required')
  return receipt
}

if (require.main === module) {
  try {
    validateProductionCandidate({
      candidateSha: process.env.CANDIDATE_SHA,
      approvedSha: process.env.PRD_APPROVED_MAINTENANCE_SHA,
      approvedReceiptSha256: process.env.PRD_APPROVED_RECEIPT_SHA256,
      receiptBytes: fs.readFileSync(process.argv[2]),
    })
    console.log(
      'Exact production candidate receipt validated; deployment remains separately authorized.'
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = { validateProductionCandidate }

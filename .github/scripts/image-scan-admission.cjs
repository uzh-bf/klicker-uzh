// Admission contract for the staging image scans.
//
// The staging controller promotes immutable image digests. A scan receipt is
// only evidence for a promotion when it describes the exact artifact being
// promoted: the same image repository, the same digest, the same run, and the
// same source revision. Comparing digests rather than tags is what prevents a
// rebuild after the scan from being promoted as if it had been scanned.
//
// The inventory lists every image that publishes a receipt, together with the
// job that publishes it and the job that scans it. It grows only when the scan
// pilot covers another image, and every entry is required: a missing receipt is
// a blocked candidate, not an unreviewed image.
//
// The decision functions are pure so the contract is covered without a token,
// a network, or an Actions run.

const { RECEIPT_SCHEMA_VERSION } = require('./image-scan-receipt.cjs')

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/
const FAIL_SEVERITIES = ['HIGH', 'CRITICAL']

const SCAN_ADMISSION_INVENTORY = Object.freeze([
  {
    buildJob: 'build-arm',
    scanJob: 'scan-arm',
    workflowPath: '.github/workflows/v3_backend-docker-stg.yml',
  },
  {
    buildJob: 'build-migrator-arm',
    scanJob: 'scan-migrator-arm',
    workflowPath: '.github/workflows/v3_backend-docker-stg.yml',
  },
])

// The scan job is the job whose success proves the policy step passed; the
// receipt it uploads alone does not, because that upload also runs when the
// policy step fails.
function evaluateScanJobStatus(observedJobs, scanJob) {
  const matches = (observedJobs ?? []).filter((job) => job?.name === scanJob)
  if (matches.length === 0) return { status: 'missing' }
  if (matches.length > 1) return { status: 'wrong_evidence' }
  const job = matches[0]
  if (job.status !== 'completed') return { status: 'running' }
  if (job.conclusion !== 'success') return { status: 'failed' }
  return { status: 'success' }
}

function rejected(reason) {
  return { ok: false, reason }
}

function validateScanReceipt(receipt, expected) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return rejected('receipt is not an object')
  }
  if (receipt.schemaVersion !== RECEIPT_SCHEMA_VERSION) {
    return rejected('receipt schema is ' + String(receipt.schemaVersion))
  }
  if (!DIGEST_PATTERN.test(String(expected.digest ?? ''))) {
    return rejected('promoted digest is incomplete')
  }
  if (receipt.artifact?.digest !== expected.digest) {
    return rejected('receipt digest does not match the promoted digest')
  }
  const image = String(receipt.artifact?.image ?? '')
  if (image !== expected.image + '@' + expected.digest) {
    return rejected('receipt image is not the promoted repository and digest')
  }
  if (receipt.run?.id !== String(expected.runId)) {
    return rejected('receipt run id does not match the publishing run')
  }
  if (receipt.run?.attempt !== String(expected.runAttempt)) {
    return rejected('receipt attempt does not match the publishing attempt')
  }
  if (receipt.run?.gitSha !== expected.candidateSha) {
    return rejected('receipt source revision is not the candidate')
  }
  if (receipt.scanner?.name !== 'trivy') {
    return rejected('receipt scanner is ' + String(receipt.scanner?.name))
  }
  const failOn = receipt.policy?.failOn
  if (
    !Array.isArray(failOn) ||
    FAIL_SEVERITIES.some((severity) => !failOn.includes(severity)) ||
    receipt.policy?.failOnUnfixed !== false
  ) {
    return rejected('receipt policy does not match the fixable-only policy')
  }
  return { ok: true, receipt }
}

function findScanReceipt(receipts, expected) {
  for (const receipt of receipts ?? []) {
    const result = validateScanReceipt(receipt, expected)
    if (result.ok) return result
    if (receipt?.artifact?.digest === expected.digest) return result
  }
  return rejected('no receipt covers the promoted digest')
}

// Decide whether every scanned image is covered for one candidate. `images`
// are the resolved references of the candidate's staging builds, `runs` maps a
// workflow path to its publishing run identity, and `receipts` holds the
// receipts downloaded from that run.
function evaluateScanAdmission({ images, receipts, runs, inventory }) {
  const entries = []
  for (const entry of inventory || SCAN_ADMISSION_INVENTORY) {
    const built = (images ?? []).find(
      (image) =>
        image.workflow_path === entry.workflowPath &&
        image.job_name === entry.buildJob
    )
    if (!built) {
      entries.push({
        ...entry,
        ok: false,
        reason: 'no resolved image for the publishing job',
      })
      continue
    }
    const run = (runs ?? {})[entry.workflowPath]
    if (!run) {
      entries.push({ ...entry, ok: false, reason: 'no publishing run' })
      continue
    }
    const result = findScanReceipt(receipts?.[entry.workflowPath], {
      candidateSha: run.sha,
      digest: built.digest,
      image: built.repository,
      runAttempt: run.attempt,
      runId: run.id,
    })
    entries.push({
      ...entry,
      digest: built.digest,
      image: built.repository,
      ok: result.ok,
      reason: result.ok ? 'scanned' : result.reason,
    })
  }
  const failures = entries.filter((entry) => !entry.ok)
  return {
    entries,
    valid: failures.length === 0,
    reason: failures.map((entry) => entry.reason).join(', '),
  }
}

function receiptFileName(artifactName) {
  return artifactName + '-receipt.json'
}

module.exports = {
  DIGEST_PATTERN,
  SCAN_ADMISSION_INVENTORY,
  evaluateScanAdmission,
  evaluateScanJobStatus,
  findScanReceipt,
  receiptFileName,
  validateScanReceipt,
}

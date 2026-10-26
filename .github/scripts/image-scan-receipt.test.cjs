const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const test = require('node:test')

const {
  RECEIPT_SCHEMA_VERSION,
  buildReceipt,
  evaluatePolicy,
  formatReceipt,
  readTrivyResults,
} = require('./image-scan-receipt.cjs')

const SCRIPT = path.join(__dirname, 'image-scan-receipt.cjs')
const ACTION_REF =
  'aquasecurity/trivy-action@a9c7b0f06e461e9d4b4d1711f154ee024b8d7ab8'
const DIGEST = `sha256:${'a'.repeat(64)}`
const IMAGE = `ghcr.io/rschlae/klicker-uzh/backend-docker-arm@${DIGEST}`

function receiptInput(overrides) {
  return {
    image: IMAGE,
    digest: DIGEST,
    architecture: 'linux/arm64',
    runId: '1234567890',
    runAttempt: '1',
    gitSha: 'c'.repeat(40),
    engineVersion: 'v0.74.0',
    actionRef: ACTION_REF,
    findingsReport: 'image-scan-backend-docker-arm-findings.json',
    sbomReport: 'image-scan-backend-docker-arm-sbom.cdx.json',
    scannedAt: '2026-09-12T08:30:00.000Z',
    ...overrides,
  }
}

function trivyResults(vulnerabilities) {
  return [
    {
      Target: 'backend-docker (alpine 3.22)',
      Vulnerabilities: vulnerabilities,
    },
  ]
}

function trivyDocument(vulnerabilities) {
  return {
    SchemaVersion: 2,
    Results:
      vulnerabilities.length === 0 ? null : trivyResults(vulnerabilities),
  }
}

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'image-scan-receipt-'))
}

function runCli(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })
}

test('receipt identifies the scanned artifact, run and scanner', () => {
  const input = receiptInput()
  const receipt = buildReceipt(input)

  assert.equal(receipt.schemaVersion, RECEIPT_SCHEMA_VERSION)
  assert.deepEqual(receipt.artifact, {
    image: IMAGE,
    architecture: 'linux/arm64',
    digest: DIGEST,
  })
  assert.deepEqual(receipt.run, {
    id: '1234567890',
    attempt: '1',
    gitSha: input.gitSha,
  })
  assert.deepEqual(receipt.scanner, {
    name: 'trivy',
    actionRef: ACTION_REF,
    engineVersion: 'v0.74.0',
  })
  assert.deepEqual(receipt.policy, {
    failOn: ['HIGH', 'CRITICAL'],
    failOnUnfixed: false,
    unfixedFindings: 'reported-not-gating',
  })
  assert.deepEqual(receipt.reports, {
    findings: input.findingsReport,
    sbom: input.sbomReport,
  })
  assert.equal(receipt.scannedAt, '2026-09-12T08:30:00.000Z')
  assert.deepEqual(JSON.parse(formatReceipt(receipt)), receipt)
})

test('receipt refuses tag references and mismatched digests', () => {
  assert.throws(() =>
    buildReceipt(
      receiptInput({
        image: 'ghcr.io/rschlae/klicker-uzh/backend-docker-arm:latest',
      })
    )
  )
  assert.throws(() =>
    buildReceipt(receiptInput({ digest: `sha256:${'b'.repeat(64)}` }))
  )
  assert.throws(() => buildReceipt(receiptInput({ digest: 'latest' })))
})

test('receipt refuses an incomplete run identity or unpinned scanner', () => {
  assert.throws(() => buildReceipt(receiptInput({ runId: '' })))
  assert.throws(() => buildReceipt(receiptInput({ runAttempt: undefined })))
  assert.throws(() => buildReceipt(receiptInput({ runAttempt: '0' })))
  assert.throws(() => buildReceipt(receiptInput({ gitSha: 'abc' })))
  assert.throws(() => buildReceipt(receiptInput({ engineVersion: 'latest' })))
  assert.throws(() => buildReceipt(receiptInput({ findingsReport: '' })))
  assert.throws(() => buildReceipt(receiptInput({ scannedAt: 'yesterday' })))
})

test('policy fails on fixable HIGH and CRITICAL findings only', () => {
  const summary = evaluatePolicy(
    trivyResults([
      {
        VulnerabilityID: 'CVE-1',
        Severity: 'CRITICAL',
        FixedVersion: '1.2.3-r0',
      },
      { VulnerabilityID: 'CVE-2', Severity: 'HIGH', Status: 'fixed' },
      { VulnerabilityID: 'CVE-3', Severity: 'HIGH', Status: 'affected' },
      { VulnerabilityID: 'CVE-4', Severity: 'MEDIUM', FixedVersion: '2.0.0' },
    ])
  )

  assert.deepEqual(summary, {
    reported: 3,
    fixable: 2,
    unfixed: 1,
    fixableBySeverity: { HIGH: 1, CRITICAL: 1 },
    unfixedBySeverity: { HIGH: 1, CRITICAL: 0 },
    violation: true,
  })
})

test('policy passes while still counting unfixed findings', () => {
  const summary = evaluatePolicy(
    trivyResults([
      {
        VulnerabilityID: 'CVE-5',
        Severity: 'CRITICAL',
        Status: 'will_not_fix',
      },
      { VulnerabilityID: 'CVE-6', Severity: 'HIGH', FixedVersion: '   ' },
    ])
  )

  assert.equal(summary.violation, false)
  assert.equal(summary.reported, 2)
  assert.equal(summary.fixable, 0)
  assert.equal(summary.unfixed, 2)
  assert.deepEqual(summary.unfixedBySeverity, { HIGH: 1, CRITICAL: 1 })
  assert.deepEqual(evaluatePolicy([]).violation, false)
})

test('an absent or non-Trivy report fails closed', () => {
  const directory = temporaryDirectory()
  const documents = {
    'empty.json': {},
    'array.json': [],
    'no-results.json': { SchemaVersion: 2 },
    'malformed-results.json': { SchemaVersion: 2, Results: 'nope' },
    'broken.json': '{',
  }

  for (const [name, document] of Object.entries(documents)) {
    const file = path.join(directory, name)
    fs.writeFileSync(
      file,
      typeof document === 'string' ? document : JSON.stringify(document)
    )
    assert.throws(() => readTrivyResults(file), `${name} must fail closed`)
  }
  assert.throws(() => readTrivyResults(path.join(directory, 'absent.json')))

  const empty = path.join(directory, 'no-findings.json')
  fs.writeFileSync(empty, JSON.stringify(trivyDocument([])))
  assert.deepEqual(readTrivyResults(empty), [])
})

test('receipt CLI writes the receipt next to the scan artifacts', () => {
  const output = path.join(temporaryDirectory(), 'receipt.json')
  const result = runCli([
    'receipt',
    '--output',
    output,
    '--image',
    IMAGE,
    '--digest',
    DIGEST,
    '--architecture',
    'linux/arm64',
    '--run-id',
    '1234567890',
    '--run-attempt',
    '2',
    '--git-sha',
    'c'.repeat(40),
    '--engine-version',
    'v0.74.0',
    '--action-ref',
    ACTION_REF,
    '--findings',
    'image-scan-backend-docker-arm-findings.json',
    '--sbom',
    'image-scan-backend-docker-arm-sbom.cdx.json',
  ])

  assert.equal(result.status, 0, result.stderr)
  const receipt = JSON.parse(fs.readFileSync(output, 'utf8'))
  assert.equal(receipt.schemaVersion, RECEIPT_SCHEMA_VERSION)
  assert.equal(receipt.artifact.image, IMAGE)
  assert.equal(receipt.run.attempt, '2')
  assert.equal(receipt.scanner.engineVersion, 'v0.74.0')
  assert.match(receipt.scannedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('policy CLI exits 1 for fixable findings and 0 for unfixed ones', () => {
  const directory = temporaryDirectory()
  const blocking = path.join(directory, 'blocking.json')
  const unfixedOnly = path.join(directory, 'unfixed-only.json')
  fs.writeFileSync(
    blocking,
    JSON.stringify(
      trivyDocument([
        {
          VulnerabilityID: 'CVE-1',
          Severity: 'CRITICAL',
          FixedVersion: '1.2.3-r0',
        },
      ])
    )
  )
  fs.writeFileSync(
    unfixedOnly,
    JSON.stringify(
      trivyDocument([
        { VulnerabilityID: 'CVE-2', Severity: 'HIGH', Status: 'end_of_life' },
      ])
    )
  )

  const malformed = path.join(directory, 'malformed.json')
  fs.writeFileSync(malformed, JSON.stringify({ SchemaVersion: 2 }))

  assert.equal(runCli(['check', '--report', blocking]).status, 1)
  assert.equal(runCli(['check', '--report', unfixedOnly]).status, 0)
  assert.equal(
    runCli(['check', '--report', path.join(directory, 'absent.json')]).status,
    2
  )
  assert.equal(runCli(['check', '--report', malformed]).status, 2)
})

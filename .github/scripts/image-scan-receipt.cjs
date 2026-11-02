// Provenance receipt and policy check for the staging image scans (W5 pilot).
//
// The receipt is the machine-readable record of one scanned artifact: an
// immutable image digest, the runner architecture, the pinned action and Trivy
// engine versions, the run identity, the applied policy and the audit file
// names. This module also owns the policy decision, so the job exit code and
// the recorded policy cannot drift apart.
//
// Exit codes: 0 policy satisfied, 1 policy violation, 2 configuration or
// report error. An unreadable report fails closed instead of passing.

const fs = require('node:fs')
const path = require('node:path')

const RECEIPT_SCHEMA_VERSION = 'klicker.image-scan-receipt/v1'

// Fail on fixable HIGH and CRITICAL vulnerabilities. Unfixed findings stay in
// the JSON report but never change the exit code, because no image rebuild can
// remove them today; the report is their audit source.
const FAIL_SEVERITIES = ['HIGH', 'CRITICAL']

// A reviewed exception accepts one advisory in one package until its expiry
// date. Accepted findings stay in the report but stop gating; after the expiry
// the finding gates again, which forces a fresh decision.
const DEFAULT_EXCEPTIONS_PATH = path.join(
  __dirname,
  '..',
  'image-scan-exceptions.json'
)
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/
const ENGINE_VERSION_PATTERN = /^v[0-9]+\.[0-9]+\.[0-9]+$/

function fail(message) {
  throw new Error(`image-scan-receipt: ${message}`)
}

function requiredText(label, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} is required`)
  }
  return value.trim()
}

function requiredRunNumber(label, value) {
  const text = value === undefined || value === null ? '' : String(value).trim()
  if (!/^[0-9]+$/.test(text) || Number(text) < 1) {
    fail(`${label} must be a positive integer`)
  }
  return text
}

function buildReceipt(input) {
  const digest = requiredText('digest', input.digest)
  if (!DIGEST_PATTERN.test(digest)) {
    fail(`digest must be a sha256 image digest, received ${digest}`)
  }

  const image = requiredText('image', input.image)
  if (!image.endsWith(`@${digest}`)) {
    fail(`image must be pinned to ${digest} instead of a mutable tag`)
  }

  const gitSha = requiredText('gitSha', input.gitSha)
  if (!GIT_SHA_PATTERN.test(gitSha)) {
    fail('gitSha must be a full commit SHA')
  }

  const engineVersion = requiredText('engineVersion', input.engineVersion)
  if (!ENGINE_VERSION_PATTERN.test(engineVersion)) {
    fail(
      `engineVersion must be a release version such as v0.74.0, received ${engineVersion}`
    )
  }

  const scannedAt =
    input.scannedAt === undefined
      ? new Date().toISOString()
      : requiredText('scannedAt', input.scannedAt)
  if (Number.isNaN(Date.parse(scannedAt))) {
    fail(`scannedAt must be an ISO timestamp, received ${scannedAt}`)
  }

  return {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    scannedAt,
    artifact: {
      image,
      architecture: requiredText('architecture', input.architecture),
      digest,
    },
    run: {
      id: requiredRunNumber('runId', input.runId),
      attempt: requiredRunNumber('runAttempt', input.runAttempt),
      gitSha,
    },
    scanner: {
      name: 'trivy',
      actionRef: requiredText('actionRef', input.actionRef),
      engineVersion,
    },
    policy: {
      failOn: [...FAIL_SEVERITIES],
      failOnUnfixed: false,
      unfixedFindings: 'reported-not-gating',
      acceptedExceptions: (input.acceptedExceptions ?? []).map(
        ({ ids, package: packageName, expires }) => ({
          ids: [...ids],
          package: packageName,
          expires,
        })
      ),
    },
    reports: {
      findings: requiredText('findingsReport', input.findingsReport),
      sbom: requiredText('sbomReport', input.sbomReport),
    },
  }
}

function formatReceipt(receipt) {
  return `${JSON.stringify(receipt, null, 2)}\n`
}

function writeReceipt(outputPath, receipt) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, formatReceipt(receipt))
  return outputPath
}

// Trivy reports a fix through a non-empty FixedVersion; the Status field
// carries the same information in newer report schemas.
function isFixable(vulnerability) {
  if (
    typeof vulnerability?.FixedVersion === 'string' &&
    vulnerability.FixedVersion.trim() !== ''
  ) {
    return true
  }
  return vulnerability?.Status === 'fixed'
}

function readExceptions(filePath = DEFAULT_EXCEPTIONS_PATH) {
  if (!fs.existsSync(filePath)) {
    return []
  }
  let entries
  try {
    entries = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`could not read the scan exceptions at ${filePath}: ${error.message}`)
  }
  if (!Array.isArray(entries)) {
    fail(`the scan exceptions at ${filePath} are not a list`)
  }
  return entries.map((entry, index) => {
    const label = `scan exception ${index + 1}`
    if (
      !Array.isArray(entry?.ids) ||
      entry.ids.length === 0 ||
      !entry.ids.every((id) => typeof id === 'string' && id.trim() !== '')
    ) {
      fail(`${label} needs a non-empty list of advisory ids`)
    }
    const expires = requiredText(`${label} expires`, entry.expires)
    if (!DATE_PATTERN.test(expires) || Number.isNaN(Date.parse(expires))) {
      fail(`${label} expires must be a YYYY-MM-DD date`)
    }
    return {
      ids: entry.ids.map((id) => id.trim()),
      package: requiredText(`${label} package`, entry.package),
      expires,
      reason: requiredText(`${label} reason`, entry.reason),
    }
  })
}

// An exception applies through the end of its expiry date (UTC).
function activeExceptions(exceptions, now = new Date()) {
  const today = now.toISOString().slice(0, 10)
  return exceptions.filter((exception) => today <= exception.expires)
}

function isAccepted(vulnerability, exceptions) {
  const ids = [
    vulnerability?.VulnerabilityID,
    ...(Array.isArray(vulnerability?.VendorIDs) ? vulnerability.VendorIDs : []),
  ]
  return exceptions.some(
    (exception) =>
      exception.package === vulnerability?.PkgName &&
      exception.ids.some((id) => ids.includes(id))
  )
}

function evaluatePolicy(results, exceptions = []) {
  const summary = {
    reported: 0,
    fixable: 0,
    accepted: 0,
    unfixed: 0,
    fixableBySeverity: { HIGH: 0, CRITICAL: 0 },
    unfixedBySeverity: { HIGH: 0, CRITICAL: 0 },
  }

  for (const result of results) {
    const vulnerabilities = Array.isArray(result?.Vulnerabilities)
      ? result.Vulnerabilities
      : []
    for (const vulnerability of vulnerabilities) {
      const severity = String(vulnerability?.Severity ?? '').toUpperCase()
      if (!FAIL_SEVERITIES.includes(severity)) {
        continue
      }
      summary.reported += 1
      if (isFixable(vulnerability) && isAccepted(vulnerability, exceptions)) {
        summary.accepted += 1
      } else if (isFixable(vulnerability)) {
        summary.fixable += 1
        summary.fixableBySeverity[severity] += 1
      } else {
        summary.unfixed += 1
        summary.unfixedBySeverity[severity] += 1
      }
    }
  }

  summary.violation = summary.fixable > 0
  return summary
}

function readTrivyResults(reportPath) {
  const source = requiredText('report', reportPath)
  let report
  try {
    report = JSON.parse(fs.readFileSync(source, 'utf8'))
  } catch (error) {
    fail(`could not read the Trivy JSON report at ${source}: ${error.message}`)
  }
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    fail(`the Trivy JSON report at ${source} is not a report object`)
  }
  if (typeof report.SchemaVersion !== 'number') {
    fail(`the Trivy JSON report at ${source} has no numeric SchemaVersion`)
  }
  if (!Object.hasOwn(report, 'Results')) {
    fail(`the Trivy JSON report at ${source} has no Results section`)
  }
  if (report.Results !== null && !Array.isArray(report.Results)) {
    fail(`the Trivy JSON report at ${source} has a malformed Results section`)
  }
  return report.Results ?? []
}

function parseArguments(argv) {
  const [command, ...rest] = argv
  const args = {}
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index]
    const value = rest[index + 1]
    if (typeof flag !== 'string' || !flag.startsWith('--')) {
      fail(`unexpected argument ${flag}`)
    }
    if (value === undefined || value.startsWith('--')) {
      fail(`${flag} requires a value`)
    }
    args[flag.slice(2)] = value
  }
  return { command, args }
}

function writeReceiptForRun(args) {
  return writeReceipt(
    requiredText('--output', args.output),
    buildReceipt({
      image: args.image,
      digest: args.digest,
      architecture: args.architecture,
      runId: args['run-id'],
      runAttempt: args['run-attempt'],
      gitSha: args['git-sha'],
      engineVersion: args['engine-version'],
      actionRef: args['action-ref'],
      findingsReport: args.findings,
      sbomReport: args.sbom,
      acceptedExceptions: activeExceptions(readExceptions(args.exceptions)),
    })
  )
}

function checkPolicy(args) {
  const reportPath = requiredText('--report', args.report)
  const summary = evaluatePolicy(
    readTrivyResults(reportPath),
    activeExceptions(readExceptions(args.exceptions))
  )
  console.log(
    `image-scan-receipt: ${reportPath} holds ${summary.reported} HIGH/CRITICAL ` +
      `findings: ${summary.fixable} fixable, ${summary.accepted} accepted by ` +
      `an exception, ${summary.unfixed} unfixed`
  )
  if (!summary.violation) {
    return 0
  }
  console.error(
    `::error::${summary.fixable} fixable HIGH/CRITICAL vulnerabilities ` +
      `(HIGH ${summary.fixableBySeverity.HIGH}, ` +
      `CRITICAL ${summary.fixableBySeverity.CRITICAL}); ` +
      'the unfixed findings in the same report do not affect this result'
  )
  return 1
}

function main(argv) {
  const { command, args } = parseArguments(argv)
  if (command === 'receipt') {
    console.log(`image-scan-receipt: wrote ${writeReceiptForRun(args)}`)
    return 0
  }
  if (command === 'check') {
    return checkPolicy(args)
  }
  fail(`unknown command ${command}`)
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    console.error(`::error::${error.message}`)
    process.exitCode = 2
  }
}

module.exports = {
  RECEIPT_SCHEMA_VERSION,
  activeExceptions,
  buildReceipt,
  evaluatePolicy,
  formatReceipt,
  readExceptions,
  readTrivyResults,
  writeReceipt,
}

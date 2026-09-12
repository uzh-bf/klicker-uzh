// Verified coverage inputs for the SonarCloud analysis workflow.
//
// The unit and GraphQL workflows publish LCOV coverage as an artifact of the run
// they executed. This script decides whether that artifact may be imported into
// the analysis of the current revision:
//
//   - the producing run must belong to the exact pull-request head, according to
//     GitHub's own run metadata, and the newest attempt for that head wins;
//   - when the producer records a tested-source-tree receipt, the recorded head,
//     base, and tree must match this checkout, so a report from another tree or
//     an older base cannot be imported;
//   - the producer's validated selection decides whether coverage is expected at
//     all, so a run that selected no suite is not reported as missing coverage.
//
// Anything unverified is reported and left out. Absent coverage stays visible in
// Sonar as not computed instead of being counted as a trustworthy metric, and
// only a verified import becomes a coverage input. Missing or mismatched
// evidence for a run that did execute tests fails the step, because such a result
// must not pass as a complete analysis input.

const REASON = Object.freeze({
  imported: 'imported',
  noProducers: 'no-producers',
  producerNotFound: 'producer-not-found',
  producerPending: 'producer-pending',
  producerFailed: 'producer-failed',
  selectionNoChange: 'selection-no-change',
  evidenceMissing: 'evidence-missing',
  coverageMissing: 'coverage-missing',
  receiptMissing: 'receipt-missing',
  receiptMismatch: 'receipt-mismatch',
  runIdentityMismatch: 'run-identity-mismatch',
})

// Reasons that make the whole step fail. A pending or failed producer does not:
// its own required check already carries that result, and the analysis simply
// runs without that coverage input.
const FAILING_REASONS = new Set([
  REASON.evidenceMissing,
  REASON.coverageMissing,
  REASON.receiptMismatch,
  REASON.runIdentityMismatch,
])

function parseProducerWorkflows(value) {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function workflowFileName(workflowPath) {
  return workflowPath.split('/').pop()
}

// The newest run for a head is the newest attempt of the highest run number.
// A re-run of the same commit therefore supersedes an earlier attempt.
function selectNewestRun(runs) {
  const candidates = (runs || []).filter((run) => run && run.id)
  if (candidates.length === 0) return null
  return candidates.slice().sort((left, right) => {
    const runNumber = (right.run_number || 0) - (left.run_number || 0)
    if (runNumber !== 0) return runNumber
    return (right.run_attempt || 1) - (left.run_attempt || 1)
  })[0]
}

function validateTestedTree(receipt, expected) {
  if (!receipt) return null
  if (receipt.event && receipt.event !== 'pull_request') {
    return {
      ok: false,
      reason: 'receipt event ' + JSON.stringify(receipt.event),
    }
  }
  const checks = [
    ['headSha', receipt.headSha, expected.headSha],
    ['baseSha', receipt.baseSha, expected.baseSha],
    ['treeSha', receipt.treeSha, expected.treeSha],
  ]
  for (const [field, actual, want] of checks) {
    if (!actual || !want || actual !== want) {
      return { ok: false, reason: field + ' mismatch' }
    }
  }
  return { ok: true }
}

function resolveSelection(evidence) {
  const state = evidence && evidence.selection && evidence.selection.state
  return state === 'run' || state === 'no-change' ? state : null
}

// Decide one producer's outcome from already-fetched GitHub metadata. Kept pure
// so the decision table is covered without network access or a GitHub token.
function decideProducer(input) {
  const { run, artifacts, evidence, receipt, expectedTree } = input
  if (!run) return { state: REASON.producerNotFound, importable: false }
  if (run.status !== 'completed') {
    return { state: REASON.producerPending, importable: false }
  }
  if (expectedTree && run.head_sha && run.head_sha !== expectedTree.headSha) {
    return {
      state: REASON.runIdentityMismatch,
      importable: false,
      detail: 'run head ' + run.head_sha + ' is not the analyzed head',
    }
  }
  if (run.conclusion !== 'success') {
    return { state: REASON.producerFailed, importable: false }
  }
  const selection = resolveSelection(evidence)
  if (!selection) {
    return { state: REASON.evidenceMissing, importable: false }
  }
  if (selection === 'no-change') {
    return { state: REASON.selectionNoChange, importable: false }
  }
  const treeCheck = validateTestedTree(receipt, expectedTree || {})
  if (!treeCheck) {
    return { state: REASON.receiptMissing, importable: false }
  }
  if (!treeCheck.ok) {
    return {
      state: REASON.receiptMismatch,
      importable: false,
      detail: treeCheck.reason,
    }
  }
  const coverage = (artifacts || []).find(
    (artifact) => artifact.name === 'coverage-lcov'
  )
  if (!coverage) {
    return { state: REASON.coverageMissing, importable: false }
  }
  return { state: REASON.imported, importable: true, artifactId: coverage.id }
}

function buildScannerArgs(lcovPaths) {
  if (!lcovPaths || lcovPaths.length === 0) return ''
  return '-Dsonar.javascript.lcov.reportPaths=' + lcovPaths.join(',')
}

function formatSummary(results) {
  const lines = [
    '### SonarCloud coverage inputs',
    '',
    '| Producer | Run | Selection | Outcome |',
    '| --- | --- | --- | --- |',
  ]
  for (const result of results) {
    lines.push(
      '| ' +
        result.producer +
        ' | ' +
        (result.runId ? String(result.runId) : 'none') +
        ' | ' +
        (result.selection || 'unknown') +
        ' | ' +
        result.state +
        (result.detail ? ': ' + result.detail : '') +
        ' |'
    )
  }
  if (results.length === 0) {
    lines.push('| none | none | unknown | ' + REASON.noProducers + ' |')
  }
  lines.push('')
  lines.push(
    'Coverage is imported only when the producing run belongs to this revision'
  )
  lines.push(
    'and recorded the tested source tree. Unimported coverage reads as not'
  )
  lines.push('computed in SonarCloud rather than as a satisfied metric.')
  return lines.join('\n')
}

function summarizeFailures(results) {
  return results.filter((result) => FAILING_REASONS.has(result.state))
}

// Fetch the newest completed attempt of a producer workflow for one head,
// waiting through a bounded window while a producer is still running so the
// analysis does not race the tests it consumes.
async function awaitProducerRun(transport, workflowPath, headSha, limits) {
  const deadline = (await transport.now()) + limits.waitMs
  let run = null
  for (;;) {
    const runs = await transport.listRuns(
      workflowFileName(workflowPath),
      headSha
    )
    run = selectNewestRun(runs)
    if (run && run.status === 'completed') return run
    if ((await transport.now()) >= deadline) return run
    await transport.sleep(limits.pollMs)
  }
}

async function collectCoverage(deps) {
  const { transport, producers, headSha, baseSha, treeSha, limits } = deps
  const results = []
  const lcovPaths = []
  for (const producer of producers) {
    const run = await awaitProducerRun(transport, producer, headSha, limits)
    const artifacts = run ? await transport.listArtifacts(run.id) : []
    const evidence = await transport.readJsonArtifact(
      artifacts,
      'required-ci-evidence'
    )
    const receipt = await transport.readJsonArtifact(
      artifacts,
      'ci-validation-receipt'
    )
    const decision = decideProducer({
      run,
      artifacts,
      evidence,
      receipt,
      expectedTree: { headSha, baseSha, treeSha },
    })
    const result = {
      producer,
      runId: run ? run.id : null,
      selection:
        evidence && evidence.selection ? evidence.selection.state : null,
      ...decision,
    }
    if (decision.importable) {
      const paths = await transport.extractLcov(
        decision.artifactId,
        workflowFileName(producer)
      )
      if (paths.length === 0) {
        results.push({
          ...result,
          state: REASON.coverageMissing,
          importable: false,
        })
        continue
      }
      lcovPaths.push(...paths)
    }
    results.push(result)
  }
  return { results, lcovPaths, scannerArgs: buildScannerArgs(lcovPaths) }
}

async function main() {
  const producers = parseProducerWorkflows(
    process.env.COVERAGE_PRODUCER_WORKFLOWS
  )
  const headSha = process.env.HEAD_SHA || ''
  const baseSha = process.env.BASE_SHA || ''
  if (producers.length === 0 || !headSha || !baseSha) {
    throw new Error(
      'COVERAGE_PRODUCER_WORKFLOWS, HEAD_SHA, and BASE_SHA are required'
    )
  }
  const transport = require('./sonar-coverage-transport.cjs')({
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
  })
  const treeSha = transport.treeSha()
  const { results, scannerArgs } = await collectCoverage({
    transport,
    producers,
    headSha,
    baseSha,
    treeSha,
    limits: {
      waitMs: Number(process.env.COVERAGE_WAIT_SECONDS || 900) * 1000,
      pollMs: Number(process.env.COVERAGE_POLL_SECONDS || 30) * 1000,
    },
  })
  const summary = formatSummary(results)
  process.stdout.write(summary + '\n')
  if (process.env.GITHUB_STEP_SUMMARY) {
    require('node:fs').appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      summary + '\n'
    )
  }
  if (process.env.GITHUB_OUTPUT) {
    require('node:fs').appendFileSync(
      process.env.GITHUB_OUTPUT,
      'scannerArgs=' + scannerArgs + '\n'
    )
  }
  const failures = summarizeFailures(results)
  if (failures.length > 0) {
    for (const failure of failures) {
      process.stderr.write(
        '::error::' +
          failure.producer +
          ' produced an unusable coverage input (' +
          failure.state +
          (failure.detail ? ': ' + failure.detail : '') +
          ')\n'
      )
    }
    return 1
  }
  if (!scannerArgs) {
    process.stdout.write(
      'No verified coverage input was imported; coverage reads as not computed.\n'
    )
  }
  return 0
}

if (require.main === module) {
  main().then(
    (code) => {
      process.exitCode = code
    },
    (error) => {
      process.stderr.write('::error::' + (error && error.message) + '\n')
      process.exitCode = 1
    }
  )
}

module.exports = {
  FAILING_REASONS,
  REASON,
  buildScannerArgs,
  collectCoverage,
  decideProducer,
  formatSummary,
  parseProducerWorkflows,
  resolveSelection,
  selectNewestRun,
  summarizeFailures,
  validateTestedTree,
  workflowFileName,
}

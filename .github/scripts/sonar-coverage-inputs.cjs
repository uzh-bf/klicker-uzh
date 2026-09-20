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
  evidenceUnreadable: 'evidence-unreadable',
  coverageMissing: 'coverage-missing',
  coverageUnreadable: 'coverage-unreadable',
  receiptMissing: 'receipt-missing',
  receiptMismatch: 'receipt-mismatch',
  runIdentityMismatch: 'run-identity-mismatch',
})

// Reasons that make the whole step fail. A pending or failed producer does not:
// its own required check already carries that result, and the analysis simply
// runs without that coverage input.
const FAILING_REASONS = new Set([
  REASON.evidenceMissing,
  REASON.evidenceUnreadable,
  REASON.coverageMissing,
  REASON.coverageUnreadable,
  REASON.receiptMismatch,
  REASON.runIdentityMismatch,
])

// One analysis is published per pull request, head, and base. A run either
// publishes it or defers to the run that observes every producer terminal, so
// no job ever occupies a runner while a queued test run finishes.
const DECISION = Object.freeze({ scan: 'scan', defer: 'defer' })

const DEFER_REASON = Object.freeze({
  draft: 'draft-pull-request',
  closed: 'closed-pull-request',
  changeClass: 'change-class-excludes-analysis',
  producerPending: 'producer-pending',
  analysisPublished: 'analysis-already-published',
})

function deferDecision(reason, detail) {
  return { action: DECISION.defer, reason, detail: detail || '' }
}

// Decide whether this run may analyze, from already-resolved facts only. The
// table is ordered so the cheapest and most decisive reason wins: a pull request
// that must not be analyzed first, then a producer that has not finished, then a
// revision whose analysis already exists. An explicit re-run of the analysis
// ignores the published receipt, because repeating a published analysis is what
// a re-run asks for.
function decideAnalysisAction(input) {
  const {
    pullRequest,
    staticAnalysis,
    pendingProducers,
    publishedAnalysis,
    isRerun,
  } = input || {}
  // A branch run has no pull request and no coverage to import; it analyzes.
  if (!pullRequest) {
    return { action: DECISION.scan, reason: 'branch-analysis', detail: '' }
  }
  if (pullRequest.draft) {
    return deferDecision(
      DEFER_REASON.draft,
      'the pull request is still a draft'
    )
  }
  if (pullRequest.state && pullRequest.state !== 'open') {
    return deferDecision(
      DEFER_REASON.closed,
      'the pull request is ' + pullRequest.state
    )
  }
  if (staticAnalysis === 'skip') {
    return deferDecision(
      DEFER_REASON.changeClass,
      'this change class cannot alter analyzed source'
    )
  }
  if (pendingProducers && pendingProducers.length > 0) {
    return deferDecision(
      DEFER_REASON.producerPending,
      pendingProducers.join(', ') + ' has not finished'
    )
  }
  if (publishedAnalysis && !isRerun) {
    return deferDecision(
      DEFER_REASON.analysisPublished,
      'run ' + publishedAnalysis.runId + ' already analyzed this revision'
    )
  }
  return {
    action: DECISION.scan,
    reason: isRerun ? 'rerun' : 'all-producers-terminal',
    detail: '',
  }
}

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

function formatSummary(results, decision) {
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
  if (decision) {
    lines.push('')
    lines.push('Decision: ' + decision.action + ' (' + decision.reason + ')')
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

// The receipt is addressed by revision, so its artifact name alone proves that
// a run analyzed this exact head and base. The payload stays an audit record and
// never has to be downloaded to answer the question.
function analysisReceiptArtifactName(prefix, headSha, baseSha) {
  return [
    prefix || 'sonar-analysis-receipt',
    String(headSha || '').slice(0, 12),
    String(baseSha || '').slice(0, 12),
  ].join('-')
}

// Look for a receipt published by an earlier run of any analysis host for this
// head. An unreadable history leaves the answer unknown and the analysis runs:
// this lookup may only ever suppress a duplicate, never a first analysis.
async function findPublishedAnalysis(deps) {
  const { transport, workflows, headSha, baseSha, prefix, runLimit } = deps
  const name = analysisReceiptArtifactName(prefix, headSha, baseSha)
  const candidates = []
  for (const workflow of workflows || []) {
    let runs = []
    try {
      runs = await transport.listRuns(workflowFileName(workflow), headSha)
    } catch (error) {
      continue
    }
    for (const run of runs || []) {
      if (run && run.id && run.status === 'completed') candidates.push(run)
    }
  }
  candidates.sort(
    (left, right) => (right.run_number || 0) - (left.run_number || 0)
  )
  for (const run of candidates.slice(0, Number(runLimit || 5))) {
    let artifacts = []
    try {
      artifacts = await transport.listArtifacts(run.id)
    } catch (error) {
      continue
    }
    if ((artifacts || []).some((artifact) => artifact.name === name)) {
      return { runId: run.id, name }
    }
  }
  return null
}

function appendSummary(text) {
  if (!process.env.GITHUB_STEP_SUMMARY) return
  require('node:fs').appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    text + '\n'
  )
}

function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return
  require('node:fs').appendFileSync(
    process.env.GITHUB_OUTPUT,
    name + '=' + String(value == null ? '' : value) + '\n'
  )
}

function writeReceipt(filePath, receipt) {
  if (!filePath) return false
  require('node:fs').writeFileSync(
    filePath,
    JSON.stringify(receipt, null, 2) + '\n'
  )
  return true
}

// A deferred run states what it waited for and where the analysis will happen,
// so a reader of the pull request never has to guess whether a missing
// SonarCloud result was a skip or a failure.
function formatDeferredSummary(decision) {
  return [
    '### SonarCloud analysis deferred',
    '',
    '- Reason: ' +
      decision.reason +
      (decision.detail ? ' - ' + decision.detail : ''),
    '- The analysis runs in the producer run that observes all coverage',
    '  producers terminal for this revision. No runner waits for a queued one.',
    '',
  ].join('\n')
}

// Read the newest attempt of every producer workflow for one head without
// waiting for it. A producer that is still queued or running is reported as
// pending and the run defers to the producer that finishes last, so no runner
// is occupied while another queued run completes.
async function resolveProducers(transport, producers, headSha) {
  const resolved = []
  for (const producer of producers) {
    const runs = await transport.listRuns(workflowFileName(producer), headSha)
    const run = selectNewestRun(runs)
    resolved.push({
      producer,
      run,
      pending: !run || run.status !== 'completed',
    })
  }
  return resolved
}

// Import the coverage of a revision whose producers are all terminal. Every
// report is still checked against the analyzed head, base, and tested source
// tree before it becomes a scanner input; only the waiting is gone.
async function importCoverage(deps) {
  const { transport, resolved, headSha, baseSha, treeSha } = deps
  const results = []
  const lcovPaths = []
  for (const entry of resolved) {
    const { producer, run } = entry
    const artifacts = run ? await transport.listArtifacts(run.id) : []
    // One malformed artifact must not abort the collection or discard the
    // other producer's verified input: the failure is reported for this
    // producer and keeps the decision table the single reporting path.
    let evidence = null
    let receipt = null
    try {
      evidence = await transport.readJsonArtifact(
        artifacts,
        'required-ci-evidence'
      )
      receipt = await transport.readJsonArtifact(
        artifacts,
        'ci-validation-receipt'
      )
    } catch (error) {
      results.push({
        producer,
        runId: run ? run.id : null,
        selection: null,
        state: REASON.evidenceUnreadable,
        importable: false,
        detail: error && error.message,
      })
      continue
    }
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
      let paths = []
      try {
        paths = await transport.extractLcov(
          decision.artifactId,
          workflowFileName(producer)
        )
      } catch (error) {
        results.push({
          ...result,
          state: REASON.coverageUnreadable,
          importable: false,
          detail: error && error.message,
        })
        continue
      }
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
  const pullRequestNumber = Number(process.env.PR_NUMBER || 0) || 0
  if (producers.length === 0) {
    throw new Error('COVERAGE_PRODUCER_WORKFLOWS is required')
  }
  if (pullRequestNumber && (!headSha || !baseSha)) {
    throw new Error(
      'HEAD_SHA and BASE_SHA are required to analyze a pull request'
    )
  }
  const transport = require('./sonar-coverage-transport.cjs')({
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
  })
  const treeSha = transport.treeSha()
  const receiptPrefix =
    process.env.ANALYSIS_RECEIPT_PREFIX || 'sonar-analysis-receipt'
  // The live pull-request state decides, not the payload: a producer's job is
  // evaluated minutes after its event, so a pull request that became ready or
  // closed in between must be judged as it is now.
  const pullRequest = pullRequestNumber
    ? await transport.getPullRequest(pullRequestNumber)
    : null
  const resolved = pullRequest
    ? await resolveProducers(transport, producers, headSha)
    : []
  const runAttempt = Number(process.env.RUN_ATTEMPT || 1)
  const isRerun = Number.isFinite(runAttempt) && runAttempt > 1
  const pendingProducers = resolved
    .filter((entry) => entry.pending)
    .map((entry) => workflowFileName(entry.producer))
  const publishedAnalysis =
    pullRequest && !isRerun
      ? await findPublishedAnalysis({
          transport,
          workflows: parseProducerWorkflows(
            process.env.ANALYSIS_WORKFLOW_FILES
          ),
          headSha,
          baseSha,
          prefix: receiptPrefix,
          runLimit: Number(process.env.ANALYSIS_HISTORY_LIMIT || 5),
        })
      : null
  const decision = decideAnalysisAction({
    pullRequest,
    staticAnalysis: process.env.CHANGE_STATIC_ANALYSIS || '',
    pendingProducers,
    publishedAnalysis,
    isRerun,
  })
  setOutput('decision', decision.action)
  setOutput('defer_reason', decision.reason)
  if (decision.action === DECISION.defer) {
    const deferred = formatDeferredSummary(decision)
    process.stdout.write(deferred)
    appendSummary(deferred)
    return 0
  }
  const { results, scannerArgs } = await importCoverage({
    transport,
    resolved,
    headSha,
    baseSha,
    treeSha,
  })
  const summary = formatSummary(results, decision)
  process.stdout.write(summary + '\n')
  appendSummary(summary)
  setOutput('scanner_args', scannerArgs)
  setOutput(
    'receipt_name',
    analysisReceiptArtifactName(receiptPrefix, headSha, baseSha)
  )
  writeReceipt(process.env.ANALYSIS_RECEIPT_PATH, {
    schemaVersion: 1,
    event: process.env.GITHUB_EVENT_NAME || '',
    runId: Number(process.env.GITHUB_RUN_ID || 0),
    runAttempt: Number.isFinite(runAttempt) ? runAttempt : 1,
    pullRequest: pullRequestNumber || null,
    headSha: headSha || null,
    baseSha: baseSha || null,
    treeSha,
    decision: decision.reason,
    coverage: results.map((result) => ({
      producer: result.producer,
      runId: result.runId,
      selection: result.selection,
      state: result.state,
      importable: Boolean(result.importable),
    })),
  })
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
  DECISION,
  DEFER_REASON,
  FAILING_REASONS,
  REASON,
  analysisReceiptArtifactName,
  buildScannerArgs,
  decideAnalysisAction,
  decideProducer,
  findPublishedAnalysis,
  formatDeferredSummary,
  formatSummary,
  importCoverage,
  parseProducerWorkflows,
  resolveProducers,
  resolveSelection,
  selectNewestRun,
  summarizeFailures,
  validateTestedTree,
  writeReceipt,
  workflowFileName,
}

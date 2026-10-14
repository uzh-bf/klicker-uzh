const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { describe, it } = require('node:test')

const {
  DECISION,
  DEFER_REASON,
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
  selectNewestRun,
  summarizeFailures,
  validateTestedTree,
  writeReceipt,
} = require('./sonar-coverage-inputs.cjs')

const EXPECTED_TREE = {
  headSha: 'head-sha',
  baseSha: 'base-sha',
  treeSha: 'tree-sha',
}

const RECEIPT = {
  schemaVersion: 1,
  event: 'pull_request',
  headSha: 'head-sha',
  baseSha: 'base-sha',
  treeSha: 'tree-sha',
}

const EVIDENCE_RUN = { selection: { state: 'run', reason: 'success' } }
const EVIDENCE_NO_CHANGE = {
  selection: { state: 'no-change', reason: 'no-change' },
}

function completedRun(overrides) {
  return {
    id: 11,
    head_sha: 'head-sha',
    status: 'completed',
    conclusion: 'success',
    run_attempt: 1,
    run_number: 5,
    ...overrides,
  }
}

const COVERAGE_ARTIFACT = { id: 900, name: 'coverage-lcov' }

function fakeTransport(script) {
  return {
    async listRuns(workflowFile, headSha) {
      if (script.onListRuns) return script.onListRuns(workflowFile, headSha)
      return (script.runs ? script.runs(workflowFile) : []) || []
    },
    async listArtifacts(runId) {
      const artifacts =
        typeof script.artifacts === 'function'
          ? script.artifacts(runId)
          : script.artifacts
      return artifacts || []
    },
    async readJsonArtifact(_artifacts, name) {
      if (script.onReadJson) return script.onReadJson(_artifacts, name)
      if (name === 'required-ci-evidence') return script.evidence
      if (name === 'ci-validation-receipt') return script.receipt
      return null
    },
    async extractLcov(_artifactId, label) {
      if (script.onExtractLcov) return script.onExtractLcov(_artifactId, label)
      return ['coverage-inputs/' + label + '/lcov.info']
    },
  }
}

function resolvedProducer(producer, run) {
  return { producer, run, pending: !run || run.status !== 'completed' }
}

describe('selectNewestRun', () => {
  it('prefers the highest attempt of the highest run number', () => {
    const run = selectNewestRun([
      { id: 1, run_number: 5, run_attempt: 1 },
      { id: 2, run_number: 5, run_attempt: 2 },
      { id: 3, run_number: 4, run_attempt: 9 },
    ])
    assert.equal(run.id, 2)
  })

  it('returns null without runs', () => {
    assert.equal(selectNewestRun([]), null)
    assert.equal(selectNewestRun(undefined), null)
  })
})

describe('validateTestedTree', () => {
  it('accepts a receipt for the analyzed revision', () => {
    assert.deepEqual(validateTestedTree(RECEIPT, EXPECTED_TREE), { ok: true })
  })

  it('reports the mismatched field', () => {
    const result = validateTestedTree(
      { ...RECEIPT, treeSha: 'other-tree' },
      EXPECTED_TREE
    )
    assert.equal(result.ok, false)
    assert.match(result.reason, /treeSha mismatch/)
  })

  it('returns null when the producer recorded no receipt', () => {
    assert.equal(validateTestedTree(null, EXPECTED_TREE), null)
  })
})

describe('decideProducer', () => {
  const baseInput = {
    run: completedRun(),
    artifacts: [COVERAGE_ARTIFACT],
    evidence: EVIDENCE_RUN,
    receipt: RECEIPT,
    expectedTree: EXPECTED_TREE,
  }

  it('imports verified coverage', () => {
    assert.equal(decideProducer(baseInput).state, REASON.imported)
  })

  it('does not import without a producer run', () => {
    assert.equal(
      decideProducer({ ...baseInput, run: null }).state,
      REASON.producerNotFound
    )
  })

  it('does not import while the producer is still running', () => {
    assert.equal(
      decideProducer({
        ...baseInput,
        run: completedRun({ status: 'in_progress' }),
      }).state,
      REASON.producerPending
    )
  })

  it('does not import from a failed producer', () => {
    assert.equal(
      decideProducer({
        ...baseInput,
        run: completedRun({ conclusion: 'failure' }),
      }).state,
      REASON.producerFailed
    )
  })

  it('rejects a run that does not belong to the analyzed head', () => {
    const decision = decideProducer({
      ...baseInput,
      run: completedRun({ head_sha: 'different-head' }),
    })
    assert.equal(decision.state, REASON.runIdentityMismatch)
  })

  it('requires validated selection evidence', () => {
    assert.equal(
      decideProducer({ ...baseInput, evidence: null }).state,
      REASON.evidenceMissing
    )
  })

  it('expects no coverage when the producer selected no suite', () => {
    assert.equal(
      decideProducer({ ...baseInput, evidence: EVIDENCE_NO_CHANGE }).state,
      REASON.selectionNoChange
    )
  })

  it('never imports coverage without a tested-tree receipt', () => {
    assert.equal(
      decideProducer({ ...baseInput, receipt: null }).state,
      REASON.receiptMissing
    )
  })

  it('rejects a receipt for another tree', () => {
    const decision = decideProducer({
      ...baseInput,
      receipt: { ...RECEIPT, treeSha: 'other-tree' },
    })
    assert.equal(decision.state, REASON.receiptMismatch)
  })

  it('rejects a successful run that produced no report', () => {
    assert.equal(
      decideProducer({ ...baseInput, artifacts: [] }).state,
      REASON.coverageMissing
    )
  })
})

describe('buildScannerArgs', () => {
  it('returns nothing without reports', () => {
    assert.equal(buildScannerArgs([]), '')
    assert.equal(buildScannerArgs(undefined), '')
  })

  it('lists every verified report for the scanner', () => {
    assert.equal(
      buildScannerArgs(['a/lcov.info', 'b/lcov.info']),
      '-Dsonar.javascript.lcov.reportPaths=a/lcov.info,b/lcov.info'
    )
  })
})

describe('parseProducerWorkflows', () => {
  it('trims entries and drops empty ones', () => {
    assert.deepEqual(parseProducerWorkflows(' a.yml, ,b.yml '), [
      'a.yml',
      'b.yml',
    ])
  })

  it('returns an empty list for an unset value', () => {
    assert.deepEqual(parseProducerWorkflows(undefined), [])
  })
})

const UNIT_WORKFLOW = '.github/workflows/test-unit.yml'
const GRAPHQL_WORKFLOW = '.github/workflows/test-graphql.yml'

function coverageInputs(overrides) {
  return {
    headSha: EXPECTED_TREE.headSha,
    baseSha: EXPECTED_TREE.baseSha,
    treeSha: EXPECTED_TREE.treeSha,
    ...overrides,
  }
}

describe('importCoverage', () => {
  it('imports the verified report of a terminal producer', async () => {
    const transport = fakeTransport({
      artifacts: [COVERAGE_ARTIFACT],
      evidence: EVIDENCE_RUN,
      receipt: RECEIPT,
    })
    const result = await importCoverage(
      coverageInputs({
        transport,
        resolved: [resolvedProducer(UNIT_WORKFLOW, completedRun())],
      })
    )
    assert.deepEqual(result.lcovPaths, [
      'coverage-inputs/test-unit.yml/lcov.info',
    ])
    assert.equal(
      result.scannerArgs,
      '-Dsonar.javascript.lcov.reportPaths=coverage-inputs/test-unit.yml/lcov.info'
    )
    assert.deepEqual(summarizeFailures(result.results), [])
  })

  it('collects every producer in one pass', async () => {
    const transport = fakeTransport({
      artifacts: [COVERAGE_ARTIFACT],
      evidence: EVIDENCE_RUN,
      receipt: RECEIPT,
    })
    const result = await importCoverage(
      coverageInputs({
        transport,
        resolved: [
          resolvedProducer(UNIT_WORKFLOW, completedRun()),
          resolvedProducer(GRAPHQL_WORKFLOW, completedRun({ id: 12 })),
        ],
      })
    )
    assert.deepEqual(result.lcovPaths, [
      'coverage-inputs/test-unit.yml/lcov.info',
      'coverage-inputs/test-graphql.yml/lcov.info',
    ])
    assert.deepEqual(summarizeFailures(result.results), [])
  })

  it('fails when a completed run cannot prove its coverage input', async () => {
    const transport = fakeTransport({
      artifacts: [COVERAGE_ARTIFACT],
      evidence: EVIDENCE_RUN,
      receipt: { ...RECEIPT, baseSha: 'stale-base' },
    })
    const result = await importCoverage(
      coverageInputs({
        transport,
        resolved: [resolvedProducer(UNIT_WORKFLOW, completedRun())],
      })
    )
    assert.equal(result.scannerArgs, '')
    assert.equal(summarizeFailures(result.results).length, 1)
  })

  it('keeps a producer that failed its own suite out of the failure set', async () => {
    const transport = fakeTransport({
      artifacts: [COVERAGE_ARTIFACT],
      evidence: EVIDENCE_NO_CHANGE,
      receipt: RECEIPT,
    })
    const result = await importCoverage(
      coverageInputs({
        transport,
        resolved: [
          resolvedProducer(
            UNIT_WORKFLOW,
            completedRun({ conclusion: 'skipped' })
          ),
        ],
      })
    )
    assert.equal(result.results[0].state, REASON.producerFailed)
    assert.deepEqual(summarizeFailures(result.results), [])
  })

  it('reports a producer without a run without failing the analysis', async () => {
    const transport = fakeTransport({ artifacts: [] })
    const result = await importCoverage(
      coverageInputs({
        transport,
        resolved: [resolvedProducer(UNIT_WORKFLOW, null)],
      })
    )
    assert.equal(result.results[0].state, REASON.producerNotFound)
    assert.equal(result.results[0].runId, null)
    assert.equal(result.scannerArgs, '')
    assert.deepEqual(summarizeFailures(result.results), [])
  })

  it('reports an unreadable evidence artifact and keeps the other input', async () => {
    let evidenceReads = 0
    const transport = fakeTransport({
      artifacts: [COVERAGE_ARTIFACT],
      evidence: EVIDENCE_RUN,
      receipt: RECEIPT,
      onReadJson: (_artifacts, name) => {
        if (name !== 'required-ci-evidence') {
          return name === 'ci-validation-receipt' ? RECEIPT : null
        }
        evidenceReads += 1
        if (evidenceReads === 1) {
          throw new Error(
            'expected exactly one JSON file in required-ci-evidence, found 2'
          )
        }
        return EVIDENCE_RUN
      },
    })
    const result = await importCoverage(
      coverageInputs({
        transport,
        resolved: [
          resolvedProducer(UNIT_WORKFLOW, completedRun()),
          resolvedProducer(GRAPHQL_WORKFLOW, completedRun({ id: 12 })),
        ],
      })
    )
    assert.deepEqual(
      result.results.map((entry) => entry.state),
      [REASON.evidenceUnreadable, REASON.imported]
    )
    assert.match(result.results[0].detail, /exactly one JSON file/)
    assert.deepEqual(result.lcovPaths, [
      'coverage-inputs/test-graphql.yml/lcov.info',
    ])
    assert.deepEqual(summarizeFailures(result.results), [result.results[0]])
  })

  it('reports an unreadable coverage artifact and keeps the other input', async () => {
    const transport = fakeTransport({
      artifacts: [COVERAGE_ARTIFACT],
      evidence: EVIDENCE_RUN,
      receipt: RECEIPT,
      onExtractLcov: (_artifactId, label) => {
        if (label === 'test-unit.yml') {
          throw new Error(
            'test-unit.yml/lcov.info records no source files to map'
          )
        }
        return ['coverage-inputs/' + label + '/lcov.info']
      },
    })
    const result = await importCoverage(
      coverageInputs({
        transport,
        resolved: [
          resolvedProducer(UNIT_WORKFLOW, completedRun()),
          resolvedProducer(GRAPHQL_WORKFLOW, completedRun({ id: 12 })),
        ],
      })
    )
    assert.deepEqual(
      result.results.map((entry) => entry.state),
      [REASON.coverageUnreadable, REASON.imported]
    )
    assert.match(result.results[0].detail, /records no source files/)
    assert.deepEqual(result.lcovPaths, [
      'coverage-inputs/test-graphql.yml/lcov.info',
    ])
    assert.deepEqual(summarizeFailures(result.results), [result.results[0]])
  })
})

describe('resolveProducers', () => {
  it('reports every producer of this head without waiting for it', async () => {
    const transport = fakeTransport({
      onListRuns: (workflowFile) =>
        workflowFile === 'test-unit.yml'
          ? [
              { id: 1, run_number: 4, run_attempt: 1, status: 'completed' },
              { id: 2, run_number: 5, run_attempt: 2, status: 'completed' },
            ]
          : [{ id: 3, run_number: 1, run_attempt: 1, status: 'in_progress' }],
    })
    const resolved = await resolveProducers(
      transport,
      [UNIT_WORKFLOW, GRAPHQL_WORKFLOW],
      EXPECTED_TREE.headSha
    )
    assert.deepEqual(
      resolved.map((entry) => entry.run.id),
      [2, 3]
    )
    assert.deepEqual(
      resolved.map((entry) => entry.pending),
      [false, true]
    )
  })

  it('treats a producer without a run as pending', async () => {
    const transport = fakeTransport({ runs: () => [] })
    const resolved = await resolveProducers(
      transport,
      [UNIT_WORKFLOW],
      EXPECTED_TREE.headSha
    )
    assert.equal(resolved[0].run, null)
    assert.equal(resolved[0].pending, true)
  })
})

// The analysis runs in the producer run that observes every producer terminal,
// so a run that still sees one queued releases its runner instead of holding it.
describe('decideAnalysisAction', () => {
  const input = (overrides) => ({
    pullRequest: { draft: false, state: 'open' },
    staticAnalysis: 'run',
    pendingProducers: [],
    publishedAnalysis: null,
    isRerun: false,
    ...overrides,
  })

  it('analyzes a branch push without importing coverage', () => {
    const decision = decideAnalysisAction(input({ pullRequest: null }))
    assert.equal(decision.action, DECISION.scan)
    assert.equal(decision.reason, 'branch-analysis')
  })

  it('analyzes once every producer is terminal', () => {
    const decision = decideAnalysisAction(input())
    assert.equal(decision.action, DECISION.scan)
    assert.equal(decision.reason, 'all-producers-terminal')
  })

  it('defers a draft pull request before looking at producers', () => {
    const decision = decideAnalysisAction(
      input({
        pullRequest: { draft: true, state: 'open' },
        pendingProducers: ['test-unit.yml'],
        publishedAnalysis: { runId: 7 },
      })
    )
    assert.equal(decision.action, DECISION.defer)
    assert.equal(decision.reason, DEFER_REASON.draft)
  })

  it('defers a pull request that is no longer open', () => {
    const decision = decideAnalysisAction(
      input({ pullRequest: { draft: false, state: 'closed' } })
    )
    assert.equal(decision.reason, DEFER_REASON.closed)
    assert.match(decision.detail, /closed/)
  })

  it('defers a class that cannot alter analyzed source', () => {
    const decision = decideAnalysisAction(input({ staticAnalysis: 'skip' }))
    assert.equal(decision.reason, DEFER_REASON.changeClass)
  })

  it('does not defer an unproven class', () => {
    const decision = decideAnalysisAction(input({ staticAnalysis: '' }))
    assert.equal(decision.action, DECISION.scan)
  })

  it('defers while a producer has not finished', () => {
    const decision = decideAnalysisAction(
      input({ pendingProducers: ['test-unit.yml', 'test-graphql.yml'] })
    )
    assert.equal(decision.action, DECISION.defer)
    assert.equal(decision.reason, DEFER_REASON.producerPending)
    assert.match(decision.detail, /test-unit\.yml, test-graphql\.yml/)
  })

  it('lets a pending producer win over a published analysis', () => {
    const decision = decideAnalysisAction(
      input({
        pendingProducers: ['test-graphql.yml'],
        publishedAnalysis: { runId: 42 },
      })
    )
    assert.equal(decision.reason, DEFER_REASON.producerPending)
  })

  it('defers a revision whose analysis is already published', () => {
    const decision = decideAnalysisAction(
      input({ publishedAnalysis: { runId: 42 } })
    )
    assert.equal(decision.reason, DEFER_REASON.analysisPublished)
    assert.match(decision.detail, /42/)
  })

  it('analyzes again when the run is an explicit re-run', () => {
    const decision = decideAnalysisAction(
      input({ publishedAnalysis: { runId: 42 }, isRerun: true })
    )
    assert.equal(decision.action, DECISION.scan)
    assert.equal(decision.reason, 'rerun')
  })
})

describe('analysisReceiptArtifactName', () => {
  it('addresses the receipt by head and base', () => {
    assert.equal(
      analysisReceiptArtifactName(
        'sonar-analysis-receipt',
        'abcdef1234567890',
        'fedcba0987654321'
      ),
      'sonar-analysis-receipt-abcdef123456-fedcba098765'
    )
  })

  it('keeps the default prefix when none is configured', () => {
    assert.equal(
      analysisReceiptArtifactName('', 'head', 'base'),
      'sonar-analysis-receipt-head-base'
    )
  })
})

describe('findPublishedAnalysis', () => {
  const receiptName = analysisReceiptArtifactName(
    'sonar-analysis-receipt',
    EXPECTED_TREE.headSha,
    EXPECTED_TREE.baseSha
  )
  const lookup = (transport, overrides) => ({
    transport,
    workflows: [UNIT_WORKFLOW, GRAPHQL_WORKFLOW],
    headSha: EXPECTED_TREE.headSha,
    baseSha: EXPECTED_TREE.baseSha,
    prefix: 'sonar-analysis-receipt',
    runLimit: 5,
    ...overrides,
  })
  const oneCompletedRun = {
    async listRuns() {
      return [{ id: 31, run_number: 2, status: 'completed' }]
    },
  }

  it('finds a receipt published by an earlier analysis', async () => {
    const transport = {
      ...oneCompletedRun,
      async listArtifacts(runId) {
        return runId === 31 ? [{ name: receiptName }] : []
      },
    }
    assert.deepEqual(await findPublishedAnalysis(lookup(transport)), {
      runId: 31,
      name: receiptName,
    })
  })

  it('ignores a receipt of another revision', async () => {
    const transport = {
      ...oneCompletedRun,
      async listArtifacts() {
        return [
          {
            name: analysisReceiptArtifactName(
              'sonar-analysis-receipt',
              'other-head',
              EXPECTED_TREE.baseSha
            ),
          },
        ]
      },
    }
    assert.equal(await findPublishedAnalysis(lookup(transport)), null)
  })

  it('ignores a run that has not completed', async () => {
    const transport = {
      async listRuns() {
        return [{ id: 31, run_number: 2, status: 'in_progress' }]
      },
      async listArtifacts() {
        return [{ name: receiptName }]
      },
    }
    assert.equal(await findPublishedAnalysis(lookup(transport)), null)
  })

  it('keeps looking when one workflow history is unreadable', async () => {
    const transport = {
      async listRuns(workflowFile) {
        if (workflowFile === 'test-unit.yml') {
          throw new Error('GitHub API returned 403')
        }
        return [{ id: 31, run_number: 2, status: 'completed' }]
      },
      async listArtifacts() {
        return [{ name: receiptName }]
      },
    }
    const found = await findPublishedAnalysis(lookup(transport))
    assert.equal(found && found.runId, 31)
  })

  it('falls back when the newest run artifacts are unreadable', async () => {
    const transport = {
      async listRuns() {
        return [
          { id: 30, run_number: 1, status: 'completed' },
          { id: 31, run_number: 2, status: 'completed' },
        ]
      },
      async listArtifacts(runId) {
        if (runId === 31) throw new Error('GitHub API returned 500')
        return [{ name: receiptName }]
      },
    }
    const found = await findPublishedAnalysis(lookup(transport))
    assert.equal(found && found.runId, 30)
  })

  it('never looks past the run limit', async () => {
    const transport = {
      async listRuns() {
        return [1, 2, 3].map((number) => ({
          id: number,
          run_number: number,
          status: 'completed',
        }))
      },
      async listArtifacts(runId) {
        return runId === 1 ? [{ name: receiptName }] : []
      },
    }
    const found = await findPublishedAnalysis(
      lookup(transport, { runLimit: 2 })
    )
    assert.equal(found, null)
  })
})

describe('formatSummary', () => {
  it('lists every producer and the decision', () => {
    const summary = formatSummary(
      [
        {
          producer: UNIT_WORKFLOW,
          runId: 11,
          selection: 'run',
          state: REASON.imported,
        },
      ],
      { action: DECISION.scan, reason: 'all-producers-terminal' }
    )
    assert.match(summary, /test-unit\.yml \| 11 \| run \| imported/)
    assert.match(summary, /Decision: scan \(all-producers-terminal\)/)
  })

  it('names an analysis without producers', () => {
    const summary = formatSummary([], {
      action: DECISION.scan,
      reason: 'branch-analysis',
    })
    assert.match(summary, /none \| none \| unknown \| no-producers/)
  })
})

describe('formatDeferredSummary', () => {
  it('names the reason and where the analysis happens', () => {
    const summary = formatDeferredSummary({
      action: DECISION.defer,
      reason: DEFER_REASON.producerPending,
      detail: 'test-unit.yml has not finished',
    })
    assert.match(summary, /producer-pending - test-unit\.yml has not finished/)
    assert.match(summary, /producer run that observes all coverage/)
  })
})

describe('writeReceipt', () => {
  it('writes the receipt as JSON', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sonar-receipt-'))
    const target = path.join(directory, 'sonar-analysis-receipt.json')
    const receipt = { schemaVersion: 1, headSha: 'head-sha', coverage: [] }
    assert.equal(writeReceipt(target, receipt), true)
    assert.deepEqual(JSON.parse(fs.readFileSync(target, 'utf8')), receipt)
  })

  it('writes nothing without a path', () => {
    assert.equal(writeReceipt('', { schemaVersion: 1 }), false)
    assert.equal(writeReceipt(undefined, { schemaVersion: 1 }), false)
  })
})

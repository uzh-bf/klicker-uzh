const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const {
  REASON,
  buildScannerArgs,
  collectCoverage,
  decideProducer,
  parseProducerWorkflows,
  selectNewestRun,
  summarizeFailures,
  validateTestedTree,
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
  let clock = 0
  return {
    sleeps: 0,
    async listRuns(workflowFile) {
      const response = script.runs(workflowFile, this.sleeps)
      return response || []
    },
    async listArtifacts() {
      return script.artifacts || []
    },
    async readJsonArtifact(_artifacts, name) {
      if (name === 'required-ci-evidence') return script.evidence
      if (name === 'ci-validation-receipt') return script.receipt
      return null
    },
    async extractLcov(_artifactId, label) {
      return ['coverage-inputs/' + label + '/lcov.info']
    },
    now() {
      return clock
    },
    async sleep(milliseconds) {
      this.sleeps += 1
      clock += milliseconds
    },
  }
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

describe('collectCoverage', () => {
  it('imports coverage from a producer that finishes inside the wait window', async () => {
    const transport = fakeTransport({
      runs: (_workflow, sleeps) =>
        sleeps === 0
          ? [completedRun({ status: 'in_progress', conclusion: null })]
          : [completedRun()],
      artifacts: [COVERAGE_ARTIFACT],
      evidence: EVIDENCE_RUN,
      receipt: RECEIPT,
    })
    const result = await collectCoverage({
      transport,
      producers: ['.github/workflows/test-unit.yml'],
      headSha: EXPECTED_TREE.headSha,
      baseSha: EXPECTED_TREE.baseSha,
      treeSha: EXPECTED_TREE.treeSha,
      limits: { waitMs: 1000, pollMs: 10 },
    })
    assert.equal(transport.sleeps, 1)
    assert.deepEqual(result.lcovPaths, [
      'coverage-inputs/test-unit.yml/lcov.info',
    ])
    assert.equal(
      result.scannerArgs,
      '-Dsonar.javascript.lcov.reportPaths=coverage-inputs/test-unit.yml/lcov.info'
    )
    assert.deepEqual(summarizeFailures(result.results), [])
  })

  it('stops waiting when the producer never completes', async () => {
    const transport = fakeTransport({
      runs: () => [completedRun({ status: 'in_progress', conclusion: null })],
      artifacts: [],
    })
    const result = await collectCoverage({
      transport,
      producers: ['.github/workflows/test-graphql.yml'],
      headSha: EXPECTED_TREE.headSha,
      baseSha: EXPECTED_TREE.baseSha,
      treeSha: EXPECTED_TREE.treeSha,
      limits: { waitMs: 30, pollMs: 10 },
    })
    assert.equal(result.scannerArgs, '')
    assert.equal(result.results[0].state, REASON.producerPending)
    assert.deepEqual(summarizeFailures(result.results), [])
  })

  it('fails when a completed run cannot prove its coverage input', async () => {
    const transport = fakeTransport({
      runs: () => [completedRun()],
      artifacts: [COVERAGE_ARTIFACT],
      evidence: EVIDENCE_RUN,
      receipt: { ...RECEIPT, baseSha: 'stale-base' },
    })
    const result = await collectCoverage({
      transport,
      producers: ['.github/workflows/test-unit.yml'],
      headSha: EXPECTED_TREE.headSha,
      baseSha: EXPECTED_TREE.baseSha,
      treeSha: EXPECTED_TREE.treeSha,
      limits: { waitMs: 10, pollMs: 5 },
    })
    assert.equal(result.scannerArgs, '')
    assert.equal(summarizeFailures(result.results).length, 1)
  })

  it('keeps a no-change producer out of the failure set', async () => {
    const transport = fakeTransport({
      runs: () => [completedRun({ conclusion: 'skipped' })],
      artifacts: [COVERAGE_ARTIFACT],
      evidence: EVIDENCE_NO_CHANGE,
      receipt: RECEIPT,
    })
    const result = await collectCoverage({
      transport,
      producers: ['.github/workflows/test-unit.yml'],
      headSha: EXPECTED_TREE.headSha,
      baseSha: EXPECTED_TREE.baseSha,
      treeSha: EXPECTED_TREE.treeSha,
      limits: { waitMs: 10, pollMs: 5 },
    })
    assert.equal(result.results[0].state, REASON.producerFailed)
    assert.deepEqual(summarizeFailures(result.results), [])
  })
})

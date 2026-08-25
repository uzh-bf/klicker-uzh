const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const {
  adjudicate,
  evaluate,
  runQualification,
  sha256,
  validateFixture,
} = require('./final-review-qualification.js')

const fixturesDir = path.join(__dirname, 'fixtures')

function minimalFixture(overrides = {}) {
  return {
    schema_version: 'qualification-fixture/v1',
    scenario: 'self-test',
    expected_outcome: 'accepts',
    expected_adjudication: 'clean',
    review: {
      schema_version: 'ocr.run-manifest/v1',
      status: 'complete',
      llm: { model: 'synthetic/model-v1' },
      finish_reason: 'stop',
      warnings: [],
      summary: {
        coverage: 'complete',
        comments: 0,
        files_reviewed: 1,
        elapsed: '1s',
        input_tokens: 50,
        output_tokens: 10,
        total_tokens: 60,
      },
      manifest: {
        schema_version: 'ocr.run-manifest/v1',
        terminal_state: 'complete',
      },
      comments: [],
    },
    notes: 'Synthetic self-test fixture.',
    ...overrides,
  }
}

function findingComment(overrides = {}) {
  return {
    path: 'src/one.ts',
    start_line: 2,
    end_line: 2,
    category: 'bug',
    severity: 'high',
    expected_disposition: 'follow-up',
    content:
      'Confidence: 90/100\nAutofix: manual\nMotivating line: `return value`\nThe cumulative change can fail after merge.',
    ...overrides,
  }
}

function twoLayerStack() {
  const baseSha = sha256('base-0').slice(0, 40)
  const headOne = sha256('head-1').slice(0, 40)
  const headTwo = sha256('head-2').slice(0, 40)
  return {
    schema_version: 'final-ai-stack-manifest/v1',
    stack_id: 'self-test-stack-91-92',
    ultimate_base: { ref: 'v3', sha: baseSha },
    stack_order: [91, 92],
    layers: [
      {
        position: 1,
        pull_request: 91,
        base_ref: 'v3',
        base_sha: baseSha,
        head_ref: 'rs/self-test-1',
        head_sha: headOne,
        title: 'Self-test layer one',
        files: [
          {
            filename: 'src/one.ts',
            status: 'modified',
            additions: 2,
            deletions: 1,
          },
        ],
      },
      {
        position: 2,
        pull_request: 92,
        base_ref: 'rs/self-test-1',
        base_sha: headOne,
        head_ref: 'rs/self-test-2',
        head_sha: headTwo,
        title: 'Self-test layer two',
        files: [
          {
            filename: 'src/two.ts',
            status: 'added',
            additions: 3,
            deletions: 0,
          },
        ],
      },
    ],
    path_index: [
      { filename: 'src/one.ts', additions: 2, deletions: 1, layers: [1] },
      { filename: 'src/two.ts', additions: 3, deletions: 0, layers: [2] },
    ],
  }
}

test('accepts a minimal complete review as clean', () => {
  const fixture = minimalFixture()
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, true)
  assert.equal(evaluation.adjudication, 'clean')
})

test('rejects unknown fixture schema versions', () => {
  const fixture = minimalFixture({ schema_version: 'fixture/other' })
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, false)
  assert.match(evaluation.reasons.join(' '), /schema_version/)
})

test('fails closed on partial coverage even without findings', () => {
  const fixture = minimalFixture({
    expected_outcome: 'fails-closed',
    expected_adjudication: null,
    review: {
      ...minimalFixture().review,
      summary: {
        ...minimalFixture().review.summary,
        coverage: 'partial',
      },
    },
  })
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, false)
  assert.match(evaluation.reasons.join(' '), /coverage/)
})

test('rejects a finding outside the known category and severity enums', () => {
  const fixture = minimalFixture({
    review: {
      ...minimalFixture().review,
      summary: { ...minimalFixture().review.summary, comments: 1 },
      comments: [
        findingComment({ category: 'architecture', severity: 'urgent' }),
      ],
    },
  })
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, false)
})

test('rejects a receipt with the wrong model or a non-stop finish reason', () => {
  const wrongModel = minimalFixture({
    review: {
      ...minimalFixture().review,
      llm: { model: 'other/model' },
    },
  })
  const wrongFinishReason = minimalFixture({
    expected_outcome: 'fails-closed',
    expected_adjudication: null,
    review: {
      ...minimalFixture().review,
      finish_reason: 'length',
    },
  })
  assert.equal(evaluate(wrongModel).valid, false)
  assert.equal(evaluate(wrongFinishReason).valid, false)
  assert.match(evaluate(wrongModel).reasons.join(' '), /model/)
  assert.match(evaluate(wrongFinishReason).reasons.join(' '), /finish_reason/)
})

test('rejects unknown receipt properties and coerced line numbers', () => {
  const unknownProperty = minimalFixture({
    review: { ...minimalFixture().review, extra: true },
  })
  const stringLine = minimalFixture({
    expected_outcome: 'fails-closed',
    expected_adjudication: null,
    review: {
      ...minimalFixture().review,
      summary: { ...minimalFixture().review.summary, comments: 1 },
      comments: [findingComment({ start_line: '2' })],
    },
  })
  assert.equal(evaluate(unknownProperty).valid, false)
  assert.equal(evaluate(stringLine).valid, false)
  assert.match(evaluate(unknownProperty).reasons.join(' '), /unknown property/)
  assert.match(evaluate(stringLine).reasons.join(' '), /start_line/)
})

test('rejects inverted line ranges', () => {
  const fixture = minimalFixture({
    review: {
      ...minimalFixture().review,
      summary: { ...minimalFixture().review.summary, comments: 1 },
      comments: [findingComment({ start_line: 9, end_line: 2 })],
    },
  })
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, false)
  assert.match(evaluation.reasons.join(' '), /inverted/)
})

test('rejects token counters that do not add up', () => {
  const fixture = minimalFixture({
    review: {
      ...minimalFixture().review,
      summary: {
        ...minimalFixture().review.summary,
        input_tokens: 50,
        output_tokens: 10,
        total_tokens: 100,
      },
    },
  })
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, false)
  assert.match(evaluation.reasons.join(' '), /token counters/)
})

test('rejects a comment count that mismatches the summary', () => {
  const fixture = minimalFixture({
    review: {
      ...minimalFixture().review,
      summary: { ...minimalFixture().review.summary, comments: 2 },
      comments: [findingComment()],
    },
  })
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, false)
  assert.match(evaluation.reasons.join(' '), /comment count/)
})

test('accepts a coherent two-layer stack with exact edges', () => {
  const fixture = minimalFixture({
    review: {
      ...minimalFixture().review,
      stack: twoLayerStack(),
    },
  })
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, true)
})

test('keeps stack validation pure across repeated evaluations', () => {
  const fixture = minimalFixture({
    review: {
      ...minimalFixture().review,
      stack: twoLayerStack(),
    },
  })
  const before = JSON.stringify(fixture)
  const first = evaluate(fixture)
  const second = evaluate(fixture)
  assert.equal(first.valid, true)
  assert.deepEqual(second, first)
  assert.equal(JSON.stringify(fixture), before)
})

test('fails closed when a layer breaks the base-sha ancestry', () => {
  const stack = twoLayerStack()
  stack.layers[1].base_sha = sha256('drifted').slice(0, 40)
  const fixture = minimalFixture({
    expected_outcome: 'fails-closed',
    expected_adjudication: null,
    review: {
      ...minimalFixture().review,
      stack,
    },
  })
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, false)
  assert.match(evaluation.reasons.join(' '), /head ref and sha/)
})

test('fails closed when a stack path index is inconsistent', () => {
  const stack = twoLayerStack()
  stack.path_index[0].layers = [1, 2]
  const fixture = minimalFixture({
    expected_outcome: 'fails-closed',
    expected_adjudication: null,
    review: {
      ...minimalFixture().review,
      stack,
    },
  })
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, false)
  assert.match(evaluation.reasons.join(' '), /inconsistent/)
})

test('fails closed when a stack path index omits a changed path', () => {
  const stack = twoLayerStack()
  stack.path_index.pop()
  const fixture = minimalFixture({
    expected_outcome: 'fails-closed',
    expected_adjudication: null,
    review: {
      ...minimalFixture().review,
      stack,
    },
  })
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, false)
  assert.match(evaluation.reasons.join(' '), /cover every changed path/)
})

test('fails closed when stack layer order and pull requests diverge', () => {
  const stack = twoLayerStack()
  stack.layers[1].pull_request = 999
  const fixture = minimalFixture({
    expected_outcome: 'fails-closed',
    expected_adjudication: null,
    review: {
      ...minimalFixture().review,
      stack,
    },
  })
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, false)
  assert.match(evaluation.reasons.join(' '), /pull_request/)
})

test('rejects a stack finding on a layer that does not own the path', () => {
  const stack = twoLayerStack()
  const fixture = minimalFixture({
    expected_adjudication: 'blocker',
    review: {
      ...minimalFixture().review,
      summary: { ...minimalFixture().review.summary, comments: 1 },
      stack,
      comments: [
        findingComment({
          path: 'src/two.ts',
          layer_numbers: [1],
        }),
      ],
    },
  })
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, false)
  assert.match(evaluation.reasons.join(' '), /invalid layer owners/)
})

test('requires explicit owners for every stack finding', () => {
  const stack = twoLayerStack()
  const fixture = minimalFixture({
    expected_outcome: 'fails-closed',
    expected_adjudication: null,
    review: {
      ...minimalFixture().review,
      summary: { ...minimalFixture().review.summary, comments: 1 },
      stack,
      comments: [findingComment({ path: 'src/two.ts' })],
    },
  })
  const evaluation = evaluate(fixture)
  assert.equal(evaluation.valid, false)
  assert.match(evaluation.reasons.join(' '), /layer_numbers/)
})

test('adjudicates explicit finding dispositions without inferring severity', () => {
  const review = minimalFixture().review
  assert.equal(
    adjudicate({
      ...review,
      comments: [
        findingComment({
          category: 'security',
          severity: 'critical',
          expected_disposition: 'blocker',
        }),
      ],
    }),
    'blocker'
  )
  assert.equal(
    adjudicate({
      ...review,
      comments: [findingComment({ expected_disposition: 'follow-up' })],
    }),
    'follow-up'
  )
  assert.equal(
    adjudicate({
      ...review,
      comments: [findingComment({ expected_disposition: 'rejected' })],
    }),
    'rejected'
  )
  assert.equal(adjudicate(review), 'clean')
})

test('fixture validation rejects an unknown expected label', () => {
  const fixture = minimalFixture({ expected_adjudication: 'later' })
  const reasons = []
  assert.equal(validateFixture(fixture, reasons), false)
  assert.match(reasons.join(' '), /expected_adjudication/)
})

test('reports a deterministic digest across repeated runs', () => {
  const first = runQualification(fixturesDir)
  const second = runQualification(fixturesDir)
  const third = runQualification(fixturesDir)
  assert.equal(first.total, 8)
  assert.equal(first.failed, 0)
  assert.equal(first.metrics.matched_count, 8)
  assert.equal(first.metrics.false_blocker_fixtures, 2)
  assert.deepEqual(first.metrics.token_totals, {
    input_tokens: 600,
    output_tokens: 200,
    total_tokens: 800,
  })
  assert.equal(first.metrics.first_trigger_success, null)
  assert.equal(first.metrics.github_action_minutes, null)
  assert.equal(first.metrics.cost_usd, null)
  assert.match(first.digest, /^[0-9a-f]{64}$/)
  assert.equal(second.digest, first.digest)
  assert.equal(third.digest, first.digest)
})

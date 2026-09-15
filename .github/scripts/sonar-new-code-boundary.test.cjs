const assert = require('node:assert/strict')
const { after, before, describe, it } = require('node:test')
const http = require('node:http')
const { spawn } = require('node:child_process')
const path = require('node:path')

const {
  STATE,
  decideBoundary,
  describeBaseline,
  describeBaselineGap,
  describeRemedy,
  describeTarget,
  evaluateBoundary,
  formatSummary,
  measureQuery,
  parseBranchTypes,
  parseMeasures,
  resolveTarget,
  selectBranch,
} = require('./sonar-new-code-boundary.cjs')

const SCRIPT = path.join(__dirname, 'sonar-new-code-boundary.cjs')

// The live shape of https://sonarcloud.io/api/measures/component: a new-code
// measure carries its value in the period, the total carries it directly.
const INFLATED_PAYLOAD = {
  component: {
    measures: [
      { metric: 'new_lines', periods: [{ index: 1, value: '328241' }] },
      { metric: 'lines', value: '328585' },
    ],
  },
}

const HEALTHY_PAYLOAD = {
  component: {
    measures: [
      { metric: 'new_lines', periods: [{ index: 1, value: '7291' }] },
      { metric: 'lines', value: '328585' },
    ],
  },
}

// The live shape of https://sonarcloud.io/api/project_branches/list on this
// project: `v3` is a short-lived branch that merges into `dev`, which is the
// recorded main branch and was last analysed in 2022.
const BRANCHES = [
  { name: 'dev', isMain: true, type: 'LONG', mergeBranch: null },
  { name: 'v3-audit', isMain: false, type: 'SHORT', mergeBranch: 'dev' },
  { name: 'v3', isMain: false, type: 'SHORT', mergeBranch: 'dev' },
]

function decide(overrides) {
  return decideBoundary({
    payload: INFLATED_PAYLOAD,
    ratioLimit: 0.5,
    target: { kind: 'branch', branch: 'v3' },
    projectKey: 'uzh-bf_klicker-uzh',
    branches: BRANCHES,
    ...overrides,
  })
}

describe('parseMeasures', () => {
  it('reads the period value for new code and the direct value for the total', () => {
    assert.deepEqual(parseMeasures(INFLATED_PAYLOAD), {
      lines: 328585,
      newLines: 328241,
    })
  })

  it('reports missing measures as null instead of zero', () => {
    assert.deepEqual(parseMeasures({ component: { measures: [] } }), {
      lines: null,
      newLines: null,
    })
    assert.deepEqual(parseMeasures({}), { lines: null, newLines: null })
    assert.deepEqual(parseMeasures(null), { lines: null, newLines: null })
  })
})

describe('evaluateBoundary', () => {
  it('flags new code covering most of the branch', () => {
    const result = evaluateBoundary({
      lines: 328585,
      newLines: 328241,
      ratioLimit: 0.5,
    })
    assert.equal(result.state, STATE.inflated)
  })

  it('accepts a bounded new-code window', () => {
    const result = evaluateBoundary({
      lines: 328585,
      newLines: 7291,
      ratioLimit: 0.5,
    })
    assert.equal(result.state, STATE.ok)
  })

  it('does not flag a share exactly on the limit', () => {
    const result = evaluateBoundary({
      lines: 100,
      newLines: 50,
      ratioLimit: 0.5,
    })
    assert.equal(result.state, STATE.ok)
  })

  it('treats absent measures and a zero total as unknown, never as passing', () => {
    assert.equal(
      evaluateBoundary({ lines: null, newLines: null, ratioLimit: 0.5 }).state,
      STATE.unknown
    )
    assert.equal(
      evaluateBoundary({ lines: 0, newLines: 0, ratioLimit: 0.5 }).state,
      STATE.unknown
    )
  })
})

describe('resolveTarget', () => {
  it('prefers the pull-request diff when a number is present', () => {
    assert.deepEqual(resolveTarget({ PR_NUMBER: '6051', BRANCH: 'v3' }), {
      kind: 'pull-request',
      pullRequest: '6051',
    })
  })

  it('targets the branch on a push', () => {
    assert.deepEqual(resolveTarget({ BRANCH: 'v3-audit' }), {
      kind: 'branch',
      branch: 'v3-audit',
    })
  })

  it('reports no target when neither is set', () => {
    assert.equal(resolveTarget({}).kind, 'none')
  })
})

describe('measureQuery', () => {
  it('asks for the branch measures on a branch target', () => {
    assert.equal(
      measureQuery({ kind: 'branch', branch: 'v3' }),
      'metricKeys=lines%2Cnew_lines&branch=v3'
    )
  })

  it('asks for the pull-request measures on a pull-request target', () => {
    assert.equal(
      measureQuery({ kind: 'pull-request', pullRequest: '6051' }),
      'metricKeys=lines%2Cnew_lines&pullRequest=6051'
    )
  })
})

describe('describeTarget', () => {
  it('names the analyzed target', () => {
    assert.equal(describeTarget({ kind: 'branch', branch: 'v3' }), 'branch v3')
    assert.equal(
      describeTarget({ kind: 'pull-request', pullRequest: '6051' }),
      'pull request 6051'
    )
    assert.equal(describeTarget({ kind: 'none' }), 'none')
  })
})

describe('decideBoundary', () => {
  it('names the boundary, target, and cause for an inflated branch', () => {
    const result = decide()
    assert.equal(result.state, STATE.inflated)
    assert.equal(result.target, 'branch v3')
    assert.equal(result.lines, 328585)
    assert.equal(result.newLines, 328241)
    assert.equal(result.branchType, 'SHORT')
    assert.equal(result.referenceBranch, 'dev')
  })

  it('reads the main branch as long-lived against the project definition', () => {
    const result = decide({ target: { kind: 'branch', branch: 'dev' } })
    assert.equal(result.branchType, 'LONG')
    assert.equal(result.referenceBranch, null)
  })

  it('reports an unknown type when the branch list has no match', () => {
    const result = decide({ branches: [] })
    assert.equal(result.branchType, null)
    assert.equal(result.referenceBranch, null)
  })
})

describe('formatSummary', () => {
  it('records the measured values and the branch type when inflated', () => {
    const summary = formatSummary(decide())
    assert.match(summary, /328585/)
    assert.match(summary, /328241/)
    assert.match(summary, /New code covers the whole branch/)
    assert.match(summary, /short-lived branch measured against dev/)
    assert.match(summary, /type `SHORT`/)
    assert.match(summary, /project_branches\/delete/)
    assert.match(summary, /project\/new_code\?id=uzh-bf_klicker-uzh/)
  })

  it('does not claim a short-lived branch for an unknown type', () => {
    const summary = formatSummary(decide({ branches: [] }))
    assert.doesNotMatch(summary, /short-lived/)
    assert.match(summary, /did not report/)
    assert.doesNotMatch(summary, /project_branches\/delete/)
  })

  it('reports an unchecked boundary as unchecked rather than as passing', () => {
    const summary = formatSummary({
      state: STATE.unavailable,
      detail: 'measures API returned HTTP 503',
    })
    assert.match(summary, /was not checked/)
    assert.match(summary, /cannot inflate|quality gate still decides/)
  })
})

describe('parseBranchTypes and selectBranch', () => {
  it('keeps the type and merge target of every listed branch', () => {
    assert.deepEqual(parseBranchTypes({ branches: BRANCHES })[2], {
      name: 'v3',
      type: 'SHORT',
      mergeBranch: 'dev',
      isMain: false,
    })
  })

  it('reports absent or malformed fields instead of inventing them', () => {
    assert.deepEqual(parseBranchTypes({}), [])
    assert.deepEqual(parseBranchTypes(null), [])
    assert.deepEqual(parseBranchTypes({ branches: [{ name: 'x' }] }), [
      { name: 'x', type: null, mergeBranch: null, isMain: false },
    ])
  })

  it('selects exactly the analyzed branch and nothing when it is unknown', () => {
    const branches = parseBranchTypes({ branches: BRANCHES })
    assert.equal(selectBranch(branches, 'v3').name, 'v3')
    assert.equal(selectBranch(branches, 'v3-audit').name, 'v3-audit')
    assert.equal(selectBranch(branches, 'v9'), null)
    assert.equal(selectBranch(branches, ''), null)
    assert.equal(selectBranch([], 'v3'), null)
  })
})

describe('describeBaseline', () => {
  it('distinguishes the short-lived, long-lived, and unknown cases', () => {
    assert.match(
      describeBaseline({ branchType: 'SHORT', referenceBranch: 'dev' }),
      /short-lived branch measured against dev/
    )
    assert.match(
      describeBaseline({ branchType: 'SHORT', referenceBranch: null }),
      /did not record/
    )
    assert.match(
      describeBaseline({ branchType: 'LONG' }),
      /project-level New Code definition/
    )
    assert.match(describeBaseline({ branchType: null }), /did not report/)
  })
})

describe('describeBaselineGap', () => {
  it('explains why the baseline inflates the share for each type', () => {
    assert.match(
      describeBaselineGap({ branchType: 'SHORT' }),
      /does not contain this branch/
    )
    assert.match(
      describeBaselineGap({ branchType: 'LONG' }),
      /covers far more than this branch/
    )
    assert.match(
      describeBaselineGap({ branchType: null }),
      /could not be identified/
    )
  })
})

describe('describeRemedy', () => {
  it('re-classifies a short-lived branch through the organization pattern', () => {
    const remedy = describeRemedy({ branchType: 'SHORT' }).join(' ')
    assert.match(remedy, /cannot be changed/)
    assert.match(remedy, /project\/branches_list\?id=uzh-bf_klicker-uzh/)
    assert.match(remedy, /project_branches\/delete/)
  })

  it('asks a long-lived branch only for a bounded project definition', () => {
    const remedy = describeRemedy({ branchType: 'LONG' }).join(' ')
    assert.match(remedy, /project-level definition/)
    assert.doesNotMatch(remedy, /project_branches\/delete/)
    assert.doesNotMatch(remedy, /cannot be changed/)
  })

  it('sends an unknown type to the branch-pattern reference.', () => {
    const remedy = describeRemedy({ branchType: null }).join(' ')
    assert.match(remedy, /long-lived-branch-pattern/)
    assert.doesNotMatch(remedy, /project_branches\/delete/)
  })
})

// Exercise the real entry point against a local server: the exported decision
// table above cannot show that the process exits non-zero and prints the
// guidance, which is the behavior CI depends on.
describe('command line boundary', () => {
  let server
  let base
  let status = 200
  let payload = INFLATED_PAYLOAD
  let branchesPayload = { branches: BRANCHES }
  let requests = []

  before(async () => {
    server = http.createServer((request, response) => {
      requests.push(request.url)
      if (status !== 200) {
        response.writeHead(status)
        response.end('{}')
        return
      }
      const body = request.url.startsWith('/api/project_branches/list')
        ? branchesPayload
        : payload
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(body))
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = 'http://127.0.0.1:' + server.address().port
  })

  after(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  function run(env) {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [SCRIPT], {
        env: { ...process.env, SONAR_API_BASE: base, ...env },
      })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk) => {
        stdout += chunk
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk
      })
      child.on('close', (code) => resolve({ code, stdout, stderr }))
    })
  }

  it('fails an inflated branch and prints the required setting', async () => {
    status = 200
    payload = INFLATED_PAYLOAD
    branchesPayload = { branches: BRANCHES }
    const result = await run({ BRANCH: 'v3', PR_NUMBER: '' })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /::error::/)
    assert.match(result.stderr, /short-lived branch measured against dev/)
    assert.match(result.stderr, /project\/branches_list\?id=uzh-bf_klicker-uzh/)
    assert.match(result.stdout, /New code covers the whole branch/)
    assert.match(result.stdout, /type `SHORT`/)
  })

  it('passes a bounded branch without failing the job', async () => {
    status = 200
    payload = HEALTHY_PAYLOAD
    branchesPayload = { branches: BRANCHES }
    const result = await run({ BRANCH: 'v3', PR_NUMBER: '' })
    assert.equal(result.code, 0)
    assert.equal(result.stderr, '')
  })

  it('stays non-fatal when the measures API is unavailable', async () => {
    status = 503
    const result = await run({ BRANCH: 'v3', PR_NUMBER: '' })
    assert.equal(result.code, 0)
    assert.match(result.stderr, /::warning::/)
    assert.match(result.stdout, /was not checked/)
    status = 200
  })

  it('does not treat as passing a target with no recorded measures', async () => {
    status = 200
    payload = { component: { measures: [] } }
    branchesPayload = { branches: BRANCHES }
    const result = await run({ BRANCH: 'v3', PR_NUMBER: '' })
    assert.equal(result.code, 0)
    assert.match(result.stdout, /boundary is/)
    assert.match(result.stdout, /unknown/)
  })

  it('asks for the pull-request measures and skips the branch check', async () => {
    status = 200
    payload = INFLATED_PAYLOAD
    branchesPayload = { branches: BRANCHES }
    requests = []
    const result = await run({ BRANCH: 'v3', PR_NUMBER: '6051' })
    assert.equal(result.code, 0)
    assert.equal(requests.length, 0)
  })

  it('requests the measures and the branch list for the analyzed branch', async () => {
    status = 200
    payload = HEALTHY_PAYLOAD
    branchesPayload = { branches: BRANCHES }
    requests = []
    await run({ BRANCH: 'v3-audit', PR_NUMBER: '' })
    assert.equal(requests.length, 2)
    assert.match(requests[0], /branch=v3-audit/)
    assert.match(requests[0], /metricKeys=lines%2Cnew_lines/)
    assert.match(requests[1], /project_branches\/list/)
    assert.match(requests[1], /project=uzh-bf_klicker-uzh/)
  })

  it('still names the boundary when the branch list cannot be read', async () => {
    status = 500
    const result = await run({ BRANCH: 'v3', PR_NUMBER: '' })
    assert.equal(result.code, 0)
    assert.match(result.stderr, /::warning::/)
    assert.match(result.stdout, /was not checked/)
    status = 200
  })
})

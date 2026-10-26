// New-code boundary guard for the SonarCloud analysis.
//
// SonarCloud fixes a branch's type at its first analysis and does not change
// it afterwards, and the type decides what "new code" means on that branch:
//
//   - a long-lived branch (the main branch, or a name matching the
//     long-lived-branch pattern) uses the project-level New Code definition;
//   - a short-lived branch has no project-level definition at all. Its new
//     code is everything that differs from the branch it merges into.
//
// The `uzh-bf_klicker-uzh` project keeps the repository's former default
// branch `dev` as its main branch, and `dev` was last analysed on 2022-08-20.
// Before the project pattern was widened, `v3` was a short-lived
// branch that merged into `dev`, so almost the whole repository
// counted as new code on it and its quality gate failed on historical
// findings, while the pull-request analysis of the same code stayed healthy
// because a pull request compares against its own base. The pattern now
// covers every `v3` branch, so both kinds are compared against the
// project-level definition.
//
// This script turns that unnamed failure into a named one. It reads the
// analyzed branch's measures and the branch's recorded type from the public
// API and reports when new code covers an implausible share of the branch, so
// the run names the cause that can actually be corrected.
//
// It reports rather than enforces. A branch's type is assigned once, so a
// short-lived integration branch cannot satisfy the branch gate until an
// operator corrects it on the project; the analysis job instead awaits the
// quality gate on a pull request, where new code is the diff against the base
// and the gate is meaningful. Failing a branch run here would block every
// required check that depends on it without changing the condition.
//
// It stays non-fatal when the API cannot be read and reports a branch without
// measures as unknown rather than as passing, so an unreadable boundary never
// becomes a false success.

const DEFAULT_RATIO_LIMIT = 0.5
const DEFAULT_PROJECT_KEY = 'uzh-bf_klicker-uzh'
const API_BASE = 'https://sonarcloud.io'

// The type is decided at a branch's first analysis, so an existing project
// cannot simply re-classify `v3`: the branch record has to be deleted and
// re-analysed, or the project recreated with the right main branch.
const LONG_LIVED_PATTERN =
  'https://sonarcloud.io/project/branches_list?id=uzh-bf_klicker-uzh'
const BRANCH_TYPE_REFERENCE =
  'https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/project-analysis/long-lived-branch-pattern'
const NEW_CODE_PAGE =
  'https://sonarcloud.io/project/new_code?id=uzh-bf_klicker-uzh'

// A short-lived branch's new code is its diff against the branch it merges
// into; a missing record of that branch gives SonarCloud no base at all, which
// makes every line new code as well. A long-lived branch instead uses the
// project-level New Code definition.
function describeBaseline(result) {
  if (result.branchType === 'LONG') {
    return 'a long-lived branch using the project-level New Code definition'
  }
  if (result.branchType === 'SHORT') {
    return result.referenceBranch
      ? 'a short-lived branch measured against ' + result.referenceBranch
      : 'a short-lived branch whose merge target SonarCloud did not record'
  }
  return 'a branch whose type SonarCloud did not report'
}

// Why the measured share is inflated: a baseline that does not contain this
// branch turns the whole repository into new code.
function describeBaselineGap(result) {
  if (result.branchType === 'LONG') {
    return 'That definition covers far more than this branch, so'
  }
  if (result.branchType === 'SHORT') {
    return 'That baseline does not contain this branch, so'
  }
  return 'The baseline could not be identified, so'
}

// The type decides the remedy as well: a short-lived branch is re-classified
// through the long-lived branch pattern, while a long-lived branch only needs
// the project-level definition narrowed. A long-lived branch whose next
// analysis has not yet run reports no new-code measures at all; that is a
// first-analysis artifact, not a definition that still has to be created.
function describeRemedy(result) {
  if (result.branchType === 'LONG') {
    return [
      'This branch already uses the project-level definition, so set a bounded',
      'one there (' + NEW_CODE_PAGE + ').',
    ]
  }
  if (result.branchType === 'SHORT') {
    return [
      'A branch type is decided at the first analysis and cannot be changed',
      'afterwards, so the fix is a platform action rather than a setting:',
      '',
      '1. Extend the long-lived branch pattern to cover this branch name on',
      '   the Branches page of the project',
      '   (' + LONG_LIVED_PATTERN + ').',
      '2. Delete the existing branch analysis through',
      '   `api/project_branches/delete`, then re-analyse so the branch is',
      '   created with the type that pattern assigns.',
      '3. Re-analyse. That next analysis establishes the new-code',
      '   baseline from the project definition by itself, so no separate New',
      '   Code setting is required.',
      '',
      'Recreating the project with the right main branch is the alternative',
      'when deleting the branch analysis is not wanted.',
    ]
  }
  return [
    'The branch type could not be read, so start with the branch analysis',
    'settings (' + BRANCH_TYPE_REFERENCE + ').',
  ]
}

const STATE = Object.freeze({
  ok: 'ok',
  inflated: 'inflated',
  unknown: 'unknown',
  unavailable: 'unavailable',
})

function branchesUrl(projectKey, base) {
  return (
    (base || API_BASE) +
    '/api/project_branches/list?project=' +
    encodeURIComponent(projectKey)
  )
}

// The branch list is the only place SonarCloud exposes the type that decides
// what new code means on a branch, so the diagnosis reads it instead of
// assuming which definition is in effect.
function parseBranchTypes(payload) {
  const branches =
    payload && Array.isArray(payload.branches) ? payload.branches : []
  return branches
    .filter((entry) => entry && typeof entry.name === 'string')
    .map((entry) => ({
      name: entry.name,
      type: typeof entry.type === 'string' ? entry.type : null,
      mergeBranch:
        typeof entry.mergeBranch === 'string' ? entry.mergeBranch : null,
      isMain: entry.isMain === true,
    }))
}

function selectBranch(branches, name) {
  if (!Array.isArray(branches) || !name) return null
  return branches.find((entry) => entry.name === name) || null
}

// The API host is overridable so the failure path can be exercised against a
// local server instead of the live service.
function apiBase() {
  return (
    (process.env.SONAR_API_BASE || '').trim().replace(/\/+$/, '') || API_BASE
  )
}

function measureValue(entry) {
  if (!entry) return null
  // A measure inside a new-code period carries its value in periods; a
  // historical metric carries it directly.
  const raw =
    entry.value !== undefined
      ? entry.value
      : Array.isArray(entry.periods) && entry.periods.length > 0
        ? entry.periods[entry.periods.length - 1].value
        : undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function parseMeasures(payload) {
  const component = payload && payload.component
  const measures =
    component && Array.isArray(component.measures) ? component.measures : []
  const find = (metric) =>
    measures.find((entry) => entry && entry.metric === metric)
  return {
    lines: measureValue(find('lines')),
    newLines: measureValue(find('new_lines')),
  }
}

function evaluateBoundary(input) {
  const { lines, newLines, ratioLimit } = input
  if (!Number.isFinite(lines) || lines <= 0) return { state: STATE.unknown }
  if (!Number.isFinite(newLines) || newLines < 0)
    return { state: STATE.unknown }
  const ratio = newLines / lines
  return {
    state: ratio > ratioLimit ? STATE.inflated : STATE.ok,
    ratio,
  }
}

// The analysis target is one branch for pushes and one pull-request diff for
// pull requests. A pull request always compares against its own base, so the
// project-level definition cannot inflate it.
function resolveTarget(env) {
  const pullRequest = (env.PR_NUMBER || '').trim()
  if (pullRequest) return { kind: 'pull-request', pullRequest }
  const branch = (env.BRANCH || '').trim()
  if (branch) return { kind: 'branch', branch }
  return { kind: 'none' }
}

function measureQuery(target) {
  const params = new URLSearchParams({ metricKeys: 'lines,new_lines' })
  if (target.kind === 'pull-request') {
    params.set('pullRequest', target.pullRequest)
  } else {
    params.set('branch', target.branch)
  }
  return params.toString()
}

function formatPercent(ratio) {
  return (ratio * 100).toFixed(1) + '%'
}

function describeTarget(target) {
  if (target.kind === 'pull-request') {
    return 'pull request ' + target.pullRequest
  }
  if (target.kind === 'branch') return 'branch ' + target.branch
  return 'none'
}

function formatSummary(result) {
  const lines = ['### SonarCloud new-code boundary', '']
  if (result.state === STATE.unavailable) {
    lines.push('The SonarCloud measures API could not be read, so the new-code')
    lines.push(
      'boundary was not checked. This is a diagnostic step; the awaited'
    )
    lines.push('quality gate still decides this job.')
    if (result.detail) {
      lines.push('')
      lines.push('Reported error: ' + result.detail)
    }
    return lines.join('\n')
  }
  if (result.state === STATE.unknown) {
    lines.push(
      'No measures are recorded for this target yet, so the boundary is'
    )
    lines.push('unknown. The first analysis of a new branch reports this.')
    return lines.join('\n')
  }
  lines.push('| Measure | Value |')
  lines.push('| --- | --- |')
  lines.push('| Analyzed target | ' + result.target + ' |')
  lines.push('| Lines in scope | ' + String(result.lines) + ' |')
  lines.push('| Lines in new code | ' + String(result.newLines) + ' |')
  lines.push('| New-code share | ' + formatPercent(result.ratio) + ' |')
  lines.push('| Boundary | ' + formatPercent(result.ratioLimit) + ' |')
  lines.push('')
  if (result.state === STATE.inflated) {
    lines.push('### New code covers the whole branch')
    lines.push('')
    lines.push(
      'New code is ' +
        formatPercent(result.ratio) +
        ' of the analyzed branch, which is the signature of'
    )
    lines.push(describeBaseline(result) + '.')
    lines.push(describeBaselineGap(result))
    lines.push(
      'nearly the whole repository enters new code and the gate fails on'
    )
    lines.push('historical findings, even though the pull-request analysis of')
    lines.push('the same code is healthy.')
    if (result.branchType) {
      lines.push('')
      lines.push(
        'SonarCloud records this branch as type `' + result.branchType + '`.'
      )
    }
    lines.push('')
    lines.push(...describeRemedy(result))
    lines.push('')
    lines.push('Source: ' + BRANCH_TYPE_REFERENCE)
    return lines.join('\n')
  }
  lines.push(
    'New code is ' + formatPercent(result.ratio) + ' of the analyzed branch,'
  )
  lines.push('so the baseline is this branch rather than the whole repository.')
  return lines.join('\n')
}

async function fetchMeasures(deps) {
  const { target, projectKey, fetchImpl, token, timeoutMs, base } = deps
  const url =
    (base || API_BASE) +
    '/api/measures/component?component=' +
    encodeURIComponent(projectKey) +
    '&' +
    measureQuery(target)
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const response = await fetchImpl(url, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error('measures API returned HTTP ' + response.status)
  }
  return response.json()
}

async function fetchBranchTypes(deps) {
  const { projectKey, fetchImpl, token, timeoutMs, base } = deps
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const response = await fetchImpl(branchesUrl(projectKey, base), {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error('branches API returned HTTP ' + response.status)
  }
  return parseBranchTypes(await response.json())
}

// Decide the boundary from already-fetched measures, so the decision table is
// covered without network access.
function decideBoundary(input) {
  const { payload, ratioLimit, target, projectKey, base, branches = [] } = input
  const { lines, newLines } = parseMeasures(payload)
  const decision = evaluateBoundary({ lines, newLines, ratioLimit })
  const branch = selectBranch(branches, target.branch)
  return {
    state: decision.state,
    ratio: decision.ratio,
    lines,
    newLines,
    ratioLimit,
    projectKey,
    base,
    target: describeTarget(target),
    branchType: branch ? branch.type : null,
    // Only a short-lived branch is measured against a merge target; a main
    // branch has none, so it is left unset rather than guessed.
    referenceBranch: branch ? branch.mergeBranch : null,
  }
}

function projectKey() {
  const configured = (process.env.SONAR_PROJECT_KEY || '').trim()
  return configured || DEFAULT_PROJECT_KEY
}

function emitSummary(summary) {
  process.stdout.write(summary + '\n')
  if (process.env.GITHUB_STEP_SUMMARY) {
    require('node:fs').appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      summary + '\n'
    )
  }
}

async function main() {
  const target = resolveTarget(process.env)
  const key = projectKey()
  const base = apiBase()
  const ratioLimit = Number(
    process.env.NEW_CODE_RATIO_LIMIT || DEFAULT_RATIO_LIMIT
  )

  if (target.kind !== 'branch') {
    emitSummary(
      [
        '### SonarCloud new-code boundary',
        '',
        'A pull-request analysis compares against its own base, so the',
        'project-level definition cannot inflate its new code. No boundary',
        'check applies.',
      ].join('\n')
    )
    return 0
  }

  let result
  try {
    const token = process.env.SONAR_TOKEN || ''
    const timeoutMs = Number(process.env.NEW_CODE_TIMEOUT_SECONDS || 30) * 1000
    const payload = await fetchMeasures({
      target,
      projectKey: key,
      fetchImpl: fetch,
      token,
      base,
      timeoutMs,
    })
    // The branch type is the decisive evidence, so the diagnosis reads it
    // rather than inferring which definition produced the measured share.
    const branches = await fetchBranchTypes({
      projectKey: key,
      fetchImpl: fetch,
      token,
      base,
      timeoutMs,
    })
    result = decideBoundary({
      payload,
      ratioLimit,
      target,
      projectKey: key,
      base,
      branches,
    })
  } catch (error) {
    // The awaited quality gate still decides this job, so a diagnostic that
    // cannot read the API must not add a failure mode of its own.
    result = {
      state: STATE.unavailable,
      detail: error && error.message ? error.message : String(error),
    }
    emitSummary(formatSummary(result))
    process.stderr.write(
      '::warning::SonarCloud new-code boundary was not checked: ' +
        result.detail +
        '\n'
    )
    return 0
  }

  emitSummary(formatSummary(result))
  if (result.state === STATE.inflated) {
    // Reported, not enforced: the branch type is fixed at the first analysis,
    // so no code change can clear this and a failure would only block the
    // promotion controller. The annotation keeps the finding on the run for
    // the operator who performs the platform correction.
    process.stderr.write(
      '::error::New code covers ' +
        formatPercent(result.ratio) +
        ' of branch ' +
        target.branch +
        ' (' +
        describeBaseline(result) +
        '); ' +
        describeRemedy(result).join(' ') +
        '\n'
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
  BRANCH_TYPE_REFERENCE,
  DEFAULT_PROJECT_KEY,
  DEFAULT_RATIO_LIMIT,
  LONG_LIVED_PATTERN,
  NEW_CODE_PAGE,
  STATE,
  apiBase,
  branchesUrl,
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
}

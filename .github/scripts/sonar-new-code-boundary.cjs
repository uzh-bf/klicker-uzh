// New-code boundary guard for the SonarCloud analysis.
//
// SonarCloud has no per-branch new-code definition for long-lived branches:
// every branch, including the default branch, uses the project-level
// definition (SonarCloud branch-analysis documentation). This project inherits
// the instance default "previous version", and the scanner reports the root
// package.json version as the project version. Every release therefore starts
// a new previous-version baseline and the entire repository re-enters new
// code, which fails the new-code quality gate on the branch even though the
// pull-request analysis of the same code is healthy.
//
// This script turns that unnamed failure into a named one. It reads the
// analyzed branch's own measures from the public API and fails the analysis
// early when new code covers an implausible share of the branch, so the run
// reports the project-level definition that must be corrected instead of
// ending in an unexplained quality-gate failure 45 minutes later.
//
// The check is a diagnostic, not an enforcement boundary: the awaited quality
// gate still decides the job, transport errors stay non-fatal, and a branch
// without measures is reported as unknown rather than as passing.

const DEFAULT_RATIO_LIMIT = 0.5
const DEFAULT_PROJECT_KEY = 'uzh-bf_klicker-uzh'
const API_BASE = 'https://sonarcloud.io'

// A version bump re-baselines "previous version" on every release, so a
// calendar window matches the release cadence without re-arming anything.
const RECOMMENDED_DEFINITION = '"Number of days" (14)'
const INHERITED_DEFINITION = '"previous version" (instance default)'

const STATE = Object.freeze({
  ok: 'ok',
  inflated: 'inflated',
  unknown: 'unknown',
  unavailable: 'unavailable',
})

function settingsUrl(projectKey, base) {
  return (base || API_BASE) + '/project/new_code?id=' + projectKey
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
        ' of the analyzed branch, which is the signature of a'
    )
    lines.push(
      'new-code definition of ' + INHERITED_DEFINITION + ' combined with a'
    )
    lines.push(
      'project version that changes on every release. The entire repository'
    )
    lines.push(
      're-enters new code, so the new-code gate fails on historical findings'
    )
    lines.push(
      'even though the pull-request analysis of the same code is healthy.'
    )
    lines.push('')
    lines.push(
      'Set the project-level New Code definition to ' +
        RECOMMENDED_DEFINITION +
        ' at:'
    )
    lines.push('')
    lines.push(settingsUrl(result.projectKey, result.base))
    lines.push('')
    lines.push(
      'The definition is project-level only; SonarCloud does not accept a'
    )
    lines.push(
      'reference branch for long-lived branches, so a scanner argument cannot'
    )
    lines.push('express it and the analysis token cannot set it.')
    return lines.join('\n')
  }
  lines.push(
    'New code is ' + formatPercent(result.ratio) + ' of the analyzed branch,'
  )
  lines.push(
    'so the definition is a bounded window rather than the whole repository.'
  )
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

// Decide the boundary from already-fetched measures, so the decision table is
// covered without network access.
function decideBoundary(input) {
  const { payload, ratioLimit, target, projectKey, base } = input
  const { lines, newLines } = parseMeasures(payload)
  const decision = evaluateBoundary({ lines, newLines, ratioLimit })
  return {
    state: decision.state,
    ratio: decision.ratio,
    lines,
    newLines,
    ratioLimit,
    projectKey,
    base,
    target: describeTarget(target),
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
    const payload = await fetchMeasures({
      target,
      projectKey: key,
      fetchImpl: fetch,
      token: process.env.SONAR_TOKEN || '',
      base,
      timeoutMs: Number(process.env.NEW_CODE_TIMEOUT_SECONDS || 30) * 1000,
    })
    result = decideBoundary({
      payload,
      ratioLimit,
      target,
      projectKey: key,
      base,
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
    process.stderr.write(
      '::error::New code covers ' +
        formatPercent(result.ratio) +
        ' of branch ' +
        target.branch +
        '; set the project-level New Code definition to ' +
        RECOMMENDED_DEFINITION +
        ' at ' +
        settingsUrl(key, base) +
        '\n'
    )
    return 1
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
  DEFAULT_PROJECT_KEY,
  DEFAULT_RATIO_LIMIT,
  INHERITED_DEFINITION,
  RECOMMENDED_DEFINITION,
  STATE,
  apiBase,
  decideBoundary,
  describeTarget,
  evaluateBoundary,
  formatSummary,
  measureQuery,
  parseMeasures,
  resolveTarget,
  settingsUrl,
}

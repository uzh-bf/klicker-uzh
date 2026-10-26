const LABEL = 'ci:priority'
const REPOSITORY = 'uzh-bf/klicker-uzh'
const SHA = /^[a-f0-9]{40}$/
const WORKFLOWS = new Set([
  'check.yml',
  'check-gitleaks.yml',
  'test-unit.yml',
  'test-graphql.yml',
  'test-olat-api.yml',
  'test-intl-production.yml',
  'test-playwright.yml',
  'v3_images-stg.yml',
])

function ordinary() {
  return {
    admitted: 'false',
    run_label_event: 'false',
    run_attempt: '',
    runner_x64: 'ubuntu-latest',
    runner_build: 'ubuntu-latest',
    runner_arm: 'ubuntu-24.04-arm',
  }
}

function requested(event, env) {
  const pr = event?.pull_request
  return (
    env.PRIORITY_ENABLED === 'true' &&
    env.GITHUB_EVENT_NAME === 'pull_request' &&
    event.repository?.full_name === REPOSITORY &&
    event.repository?.private === false &&
    pr?.state === 'open' &&
    pr.draft === false &&
    pr.head?.repo?.full_name === REPOSITORY &&
    typeof pr.user?.login === 'string' &&
    !pr.user.login.toLowerCase().endsWith('[bot]') &&
    Array.isArray(pr.labels) &&
    pr.labels.some((label) => label.name === LABEL) &&
    (event.action !== 'labeled' || event.label?.name === LABEL)
  )
}

function marker(pr) {
  return `priority:${pr.number}:${pr.head.sha}:${pr.base.sha}`
}

function samePull(actual, expected) {
  return (
    actual?.number === expected.number &&
    actual.state === 'open' &&
    actual.draft === false &&
    actual.head?.repo?.full_name === REPOSITORY &&
    actual.base?.repo?.full_name === REPOSITORY &&
    actual.head.sha === expected.head.sha &&
    actual.base.sha === expected.base.sha &&
    actual.labels?.some((label) => label.name === LABEL)
  )
}

// Collection truncation is never proof that no earlier admission exists.
async function all(api, path, key, query = {}) {
  const values = []
  for (let page = 1; page <= 10; page++) {
    const data = await api(path, { ...query, per_page: 100, page })
    const batch = key ? data?.[key] : data
    if (!Array.isArray(batch)) throw new Error('incomplete evidence')
    values.push(...batch)
    if (batch.length < 100) {
      if (key && data.total_count !== values.length)
        throw new Error('incomplete evidence')
      return values
    }
  }
  throw new Error('incomplete evidence')
}

async function route(event, env, api) {
  const denied = ordinary()
  if (!requested(event, env)) return denied
  const pr = event.pull_request
  if (
    env.GITHUB_RUN_ATTEMPT !== '1' ||
    !/^[1-9]\d*$/.test(env.GITHUB_RUN_ID ?? '') ||
    !Number.isSafeInteger(pr.number) ||
    pr.number < 1 ||
    !SHA.test(pr.head?.sha ?? '') ||
    !SHA.test(pr.base?.sha ?? '') ||
    (env.PRIORITY_CANARY_PR && env.PRIORITY_CANARY_PR !== String(pr.number)) ||
    (env.PRIORITY_CANARY_HEAD_SHA &&
      env.PRIORITY_CANARY_HEAD_SHA !== pr.head.sha) ||
    (env.PRIORITY_CANARY_BASE_SHA &&
      env.PRIORITY_CANARY_BASE_SHA !== pr.base.sha) ||
    (env.PRIORITY_EXPIRES_AT &&
      !(Date.parse(env.PRIORITY_EXPIRES_AT) > Date.now())) ||
    env.LEGACY_ADMISSIONS ||
    env.LEGACY_ADMISSION_URL ||
    env.LEGACY_BURST_GRANT ||
    env.FORCE_HOSTED_PR === String(pr.number)
  )
    return denied
  const prefix = `/repos/${REPOSITORY}`
  try {
    const pull = await api(`${prefix}/pulls/${pr.number}`)
    if (!samePull(pull, pr)) return denied
    const events = await all(api, `${prefix}/issues/${pr.number}/events`)
    const changes = events
      .filter(
        (entry) =>
          ['labeled', 'unlabeled'].includes(entry.event) &&
          entry.label?.name === LABEL
      )
      .sort((a, b) => b.id - a.id)
    const setter = changes[0]
    if (
      !setter ||
      changes.some((entry) => !Number.isSafeInteger(entry.id)) ||
      setter.event !== 'labeled' ||
      typeof setter.actor?.login !== 'string' ||
      !setter.actor.login
    )
      return denied
    const permission = await api(
      `${prefix}/collaborators/${encodeURIComponent(setter.actor.login)}/permission`
    )
    if (!['write', 'maintain', 'admin'].includes(permission?.permission))
      return denied
    const run = await api(`${prefix}/actions/runs/${env.GITHUB_RUN_ID}`)
    const file = run?.path?.split('@')[0]?.split('/').at(-1)
    if (
      !WORKFLOWS.has(file) ||
      run.path.split('@')[0] !== `.github/workflows/${file}` ||
      String(run.id) !== env.GITHUB_RUN_ID ||
      run.run_attempt !== 1 ||
      !Number.isSafeInteger(run.workflow_id) ||
      run.event !== 'pull_request' ||
      run.repository?.full_name !== REPOSITORY ||
      run.head_repository?.full_name !== REPOSITORY ||
      run.head_sha !== pr.head.sha ||
      run.display_title !== marker(pr)
    )
      return denied
    const runs = await all(
      api,
      `${prefix}/actions/workflows/${run.workflow_id}/runs`,
      'workflow_runs',
      { event: 'pull_request', head_sha: pr.head.sha }
    )
    const matches = runs.filter((entry) => entry.display_title === marker(pr))
    if (
      !matches.some((entry) => entry.id === run.id) ||
      matches.some(
        (entry) => !Number.isSafeInteger(entry.id) || entry.id < run.id
      )
    )
      return denied
    // The workflow-level priority group serializes this exact head/base from
    // admission through all consumers. An older marked run owns the request
    // even if it failed, was cancelled, or produced no billable workload.
    const fresh = await api(`${prefix}/pulls/${pr.number}`)
    if (!samePull(fresh, pr)) return denied
    return {
      admitted: 'true',
      run_label_event: event.action === 'labeled' ? 'true' : 'false',
      run_attempt: '1',
      runner_x64: 'warp-ubuntu-2404-x64-4x',
      runner_build: 'warp-ubuntu-2404-x64-8x',
      runner_arm: 'warp-ubuntu-2404-arm64-8x',
    }
  } catch {
    return denied
  }
}

async function main(env = process.env, network = fetch) {
  const fs = require('node:fs')
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))
  const signal = AbortSignal.timeout(25000)
  const api = async (path, query = {}) => {
    const url = new URL(path, 'https://api.github.com')
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, String(value))
    const response = await network(url, {
      signal,
      redirect: 'error',
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
    })
    if (!response.ok) throw new Error('unavailable evidence')
    let length = 0
    const chunks = []
    for await (const chunk of response.body) {
      length += chunk.length
      if (length > 4 * 1024 * 1024) throw new Error('oversized evidence')
      chunks.push(Buffer.from(chunk))
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  }
  const result = await route(event, env, api)
  for (const [key, value] of Object.entries(result))
    fs.appendFileSync(env.GITHUB_OUTPUT, `${key}=${value}\n`)
}

if (require.main === module) {
  main().catch(() => {
    console.error('Priority routing could not establish admission')
    process.exitCode = 1
  })
}

module.exports = { route, requested, marker, ordinary }

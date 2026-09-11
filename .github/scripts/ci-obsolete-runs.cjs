#!/usr/bin/env node
const { execFileSync } = require('node:child_process')
const { listAll, successful } = require('./ci-equivalent-run.cjs')

const REPOSITORY = 'uzh-bf/klicker-uzh'
const WORKFLOWS = new Set([
  '.github/workflows/test-playwright.yml',
  '.github/workflows/test-unit.yml',
  '.github/workflows/test-graphql.yml',
  '.github/workflows/check.yml',
  '.github/workflows/test-intl-production.yml',
])
const ACTIVE = new Set([
  'queued',
  'in_progress',
  'waiting',
  'pending',
  'requested',
])

function ghApi(endpoint, method = 'GET') {
  const output = execFileSync('gh', ['api', '--method', method, endpoint], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30000,
  })
  return { data: output.trim() ? JSON.parse(output) : null }
}

function identity(run) {
  return [
    run.id,
    run.workflow_id,
    run.path,
    run.head_sha,
    run.run_attempt,
    run.repository?.id,
    run.head_repository?.id,
    run.pull_requests?.[0]?.number,
  ]
}

function allowedRun(run) {
  return (
    Number.isSafeInteger(run.id) &&
    Number.isSafeInteger(run.workflow_id) &&
    Number.isSafeInteger(run.run_attempt) &&
    run.run_attempt > 0 &&
    run.repository?.full_name === REPOSITORY &&
    run.head_repository?.full_name === REPOSITORY &&
    WORKFLOWS.has(run.path?.split('@')[0]) &&
    run.event === 'pull_request' &&
    ACTIVE.has(run.status) &&
    run.pull_requests?.length === 1 &&
    run.pull_requests[0].head?.sha === run.head_sha &&
    run.pull_requests[0].head?.repo?.id === run.head_repository.id &&
    run.pull_requests[0].base?.repo?.id === run.repository.id
  )
}

async function inspectRun(api, id, expected) {
  const prefix = `repos/${REPOSITORY}`
  const { data: run } = await api(`${prefix}/actions/runs/${id}`)
  if (!allowedRun(run)) return { id, eligible: false, reason: 'outside-policy' }
  if (expected && JSON.stringify(identity(run)) !== JSON.stringify(expected)) {
    return { id, eligible: false, reason: 'run-identity-changed' }
  }
  const number = run.pull_requests[0].number
  const { data: pull } = await api(`${prefix}/pulls/${number}`)
  if (
    pull.number !== number ||
    pull.base?.repo?.full_name !== REPOSITORY ||
    pull.head?.repo?.full_name !== REPOSITORY ||
    pull.head.ref !== run.head_branch
  ) {
    return { id, eligible: false, reason: 'PR-identity-mismatch' }
  }
  if (pull.state === 'closed') {
    return {
      id,
      eligible: true,
      reason: 'closed-PR',
      pull: number,
      identity: identity(run),
    }
  }
  if (pull.state !== 'open' || pull.head.sha === run.head_sha) {
    return { id, eligible: false, reason: 'current-head' }
  }
  const runs = await listAll(
    async ({ page, per_page }) =>
      api(
        `${prefix}/actions/workflows/${run.workflow_id}/runs?event=pull_request&branch=${encodeURIComponent(pull.head.ref)}&head_sha=${pull.head.sha}&per_page=${per_page}&page=${page}`
      ),
    'workflow_runs'
  )
  const matches = runs
    .filter(
      (item) =>
        item.pull_requests?.length === 1 &&
        item.pull_requests[0].number === number
    )
    .sort((a, b) => b.id - a.id)
  if (!matches.length || matches[0].id <= id) {
    return { id, eligible: false, reason: 'no-current-replacement' }
  }
  const { data: replacement } = await api(
    `${prefix}/actions/runs/${matches[0].id}`
  )
  const binding = replacement.pull_requests?.[0]
  if (
    replacement.workflow_id !== run.workflow_id ||
    replacement.path !== run.path ||
    replacement.event !== 'pull_request' ||
    replacement.repository?.full_name !== REPOSITORY ||
    replacement.head_repository?.full_name !== REPOSITORY ||
    replacement.head_sha !== pull.head.sha ||
    replacement.head_branch !== pull.head.ref ||
    replacement.pull_requests?.length !== 1 ||
    binding?.number !== number ||
    binding.head?.sha !== pull.head.sha ||
    binding.base?.sha !== pull.base.sha ||
    binding.head?.repo?.id !== pull.head.repo.id ||
    binding.base?.repo?.id !== pull.base.repo.id ||
    !(ACTIVE.has(replacement.status) || successful(replacement))
  )
    return { id, eligible: false, reason: 'unverified-replacement' }
  return {
    id,
    eligible: true,
    reason: 'superseded-head',
    pull: number,
    replacement: replacement.id,
    identity: identity(run),
  }
}

async function inventory(api) {
  const all = new Map()
  for (const status of ACTIVE) {
    const runs = await listAll(
      async ({ page, per_page }) =>
        api(
          `repos/${REPOSITORY}/actions/runs?event=pull_request&status=${status}&per_page=${per_page}&page=${page}`
        ),
      'workflow_runs'
    )
    for (const run of runs) if (allowedRun(run)) all.set(run.id, run)
  }
  const results = []
  for (const run of all.values())
    results.push(await inspectRun(api, run.id, identity(run)))
  return results
}

async function cancelRun(
  api,
  id,
  {
    force = false,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {}
) {
  const initial = await inspectRun(api, id)
  if (!initial.eligible) return initial
  const current = await inspectRun(api, id, initial.identity)
  if (!current.eligible) return current
  const endpoint = `repos/${REPOSITORY}/actions/runs/${id}`
  await api(`${endpoint}/cancel`, 'POST')
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await wait(5000)
    const { data: run } = await api(endpoint)
    if (JSON.stringify(identity(run)) !== JSON.stringify(initial.identity)) {
      return {
        id,
        eligible: false,
        reason: 'run-identity-changed-after-cancel',
      }
    }
    if (run.status === 'completed')
      return { ...current, result: run.conclusion }
  }
  if (!force) return { ...current, result: 'cancellation-unconfirmed' }
  const fresh = await inspectRun(api, id, initial.identity)
  if (!fresh.eligible) return fresh
  await api(`${endpoint}/force-cancel`, 'POST')
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await wait(5000)
    const { data: run } = await api(endpoint)
    if (JSON.stringify(identity(run)) !== JSON.stringify(initial.identity)) {
      return { id, eligible: false, reason: 'run-identity-changed-after-force' }
    }
    if (run.status === 'completed') return { ...fresh, result: run.conclusion }
  }
  return { ...fresh, result: 'force-cancellation-unconfirmed' }
}

function parseArgs(args) {
  const options = { apply: false, force: false, ids: [] }
  while (args.length) {
    const arg = args.shift()
    if (arg === '--apply') options.apply = true
    else if (arg === '--force') options.force = true
    else if (arg === '--run-id') {
      const value = args.shift()
      if (
        !/^\d+$/.test(value ?? '') ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) <= 0
      )
        throw new Error('Expected a positive run ID')
      options.ids.push(Number(value))
    } else throw new Error(`Unknown argument: ${arg}`)
  }
  if ((options.apply || options.force) && !options.ids.length)
    throw new Error('Mutation requires explicit --run-id values')
  if (options.force && !options.apply)
    throw new Error('--force requires --apply')
  options.ids = [...new Set(options.ids)]
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!options.ids.length) {
    process.stdout.write(`${JSON.stringify(await inventory(ghApi), null, 2)}\n`)
    return
  }
  for (const id of options.ids) {
    const result = options.apply
      ? await cancelRun(ghApi, id, options)
      : await inspectRun(ghApi, id)
    process.stdout.write(`${JSON.stringify(result)}\n`)
    if (result.result?.endsWith('unconfirmed')) {
      process.exitCode = 1
      break
    }
  }
}

if (require.main === module)
  main().catch(() => {
    process.stderr.write(
      'CI cleanup stopped: API, identity, or input verification failed. No further runs were changed.\n'
    )
    process.exitCode = 1
  })
module.exports = { allowedRun, inspectRun, inventory, cancelRun, parseArgs }

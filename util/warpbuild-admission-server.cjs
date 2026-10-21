const crypto = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const {
  AdmissionStore,
  validateIdentity,
} = require('../.github/scripts/warpbuild-admission.cjs')

const execute = promisify(execFile)
const ISSUER = 'https://token.actions.githubusercontent.com'
const WORKFLOW =
  'uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3'
const AUDIENCE = 'klicker-playwright-admission'

function verifyToken(token, jwks, config, identity, now) {
  validateIdentity(identity)
  if (typeof token !== 'string' || token.length > 16384)
    throw new Error('invalid token')
  const parts = token.split('.')
  if (
    parts.length !== 3 ||
    parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
  )
    throw new Error('invalid token')
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
  if (
    header.alg !== 'RS256' ||
    header.typ !== 'JWT' ||
    header.crit !== undefined ||
    typeof header.kid !== 'string'
  )
    throw new Error('invalid token')
  const matching = jwks.keys?.filter(
    (key) =>
      key.kid === header.kid &&
      key.kty === 'RSA' &&
      key.use === 'sig' &&
      key.alg === 'RS256'
  )
  if (matching?.length !== 1) throw new Error('unknown signing key')
  const key = crypto.createPublicKey({ key: matching[0], format: 'jwk' })
  if (
    key.asymmetricKeyDetails.modulusLength < 2048 ||
    !crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      key,
      Buffer.from(parts[2], 'base64url')
    )
  )
    throw new Error('invalid signature')
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  const expected = {
    iss: ISSUER,
    aud: config.audience,
    repository: config.repository,
    repository_id: config.repositoryId,
    repository_visibility: 'public',
    event_name: 'pull_request',
    job_workflow_ref: config.workflowRef,
    job_workflow_sha: identity.controlSha,
    run_id: identity.runId,
    run_attempt: identity.runAttempt,
    runner_environment: 'github-hosted',
    ref: `refs/pull/${identity.pullRequestNumber}/merge`,
  }
  if (Object.entries(expected).some(([name, value]) => claims[name] !== value))
    throw new Error('untrusted execution')
  const seconds = Math.floor(now / 1000)
  if (
    ['exp', 'iat', 'nbf'].some((name) => !Number.isSafeInteger(claims[name])) ||
    claims.exp <= seconds ||
    claims.iat > seconds ||
    claims.nbf > seconds ||
    claims.exp <= claims.iat ||
    claims.exp - claims.iat > 600 ||
    seconds - claims.iat > 600
  )
    throw new Error('stale token')
  return claims
}

async function readJson(stream, maximum = 16384) {
  const chunks = []
  let size = 0
  for await (const chunk of stream) {
    size += chunk.length
    if (size > maximum) throw new Error('oversized response')
    chunks.push(Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function github(route) {
  const { stdout } = await execute('gh', ['api', route], {
    env: { ...process.env, GODEBUG: 'netdns=go' },
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  })
  return JSON.parse(stdout)
}

async function verifyRun(identity, config, api = github) {
  const root = `/repos/${config.repository}`
  const [run, pr, group, repositories] = await Promise.all([
    api(
      `${root}/actions/runs/${identity.runId}/attempts/${identity.runAttempt}`
    ),
    api(`${root}/pulls/${identity.pullRequestNumber}`),
    api(`/orgs/uzh-bf/actions/runner-groups/${config.groupId}`),
    api(
      `/orgs/uzh-bf/actions/runner-groups/${config.groupId}/repositories?per_page=100`
    ),
  ])
  if (
    String(group.id) !== config.groupId ||
    group.name !== 'Default' ||
    group.visibility !== 'selected' ||
    group.allows_public_repositories !== true ||
    group.restricted_to_workflows !== true ||
    group.inherited !== false ||
    !Array.isArray(group.selected_workflows) ||
    JSON.stringify([...group.selected_workflows].sort()) !==
      JSON.stringify([...config.selectedWorkflows].sort()) ||
    repositories.total_count !== 1 ||
    repositories.repositories?.length !== 1 ||
    String(repositories.repositories[0].id) !== config.repositoryId ||
    repositories.repositories[0].full_name !== config.repository
  )
    return false
  const binding = run.pull_requests?.filter(
    (item) => String(item.number) === identity.pullRequestNumber
  )
  if (
    String(run.id) !== identity.runId ||
    String(run.run_attempt) !== identity.runAttempt ||
    run.event !== 'pull_request' ||
    run.status !== 'in_progress' ||
    typeof run.path !== 'string' ||
    run.path.split('@')[0] !== '.github/workflows/test-playwright.yml' ||
    run.head_sha !== identity.headSha ||
    String(run.repository?.id) !== config.repositoryId ||
    run.repository?.private !== false ||
    binding?.length !== 1 ||
    binding[0].head?.sha !== identity.headSha ||
    binding[0].base?.sha !== identity.baseSha
  )
    return false
  if (
    pr.state !== 'open' ||
    pr.draft !== false ||
    String(pr.number) !== identity.pullRequestNumber ||
    pr.head?.sha !== identity.headSha ||
    pr.base?.sha !== identity.baseSha ||
    pr.head?.repo?.full_name !== config.repository ||
    pr.base?.repo?.full_name !== config.repository ||
    pr.head?.repo?.private !== false ||
    typeof pr.user?.login !== 'string' ||
    !pr.user.login.trim() ||
    pr.user.login.toLowerCase().endsWith('[bot]')
  )
    return false
  // Multiple invocations of the reusable envelope in one run must not share
  // one financial reservation. Inspect this attempt, not a previous attempt.
  const jobs = await api(
    `${root}/actions/runs/${identity.runId}/attempts/${identity.runAttempt}/jobs?per_page=100`
  )
  if (!Array.isArray(jobs.jobs) || jobs.total_count !== jobs.jobs.length)
    return false
  const preparations = jobs.jobs.filter((job) =>
    job.name.endsWith(' / prepare')
  )
  if (
    preparations.length !== 1 ||
    preparations[0].name !== 'test-playwright-execution / prepare' ||
    preparations[0].status !== 'in_progress'
  )
    return false
  return !jobs.jobs.some(
    (job) =>
      job.name.startsWith('test-playwright-execution / ') &&
      !job.name.endsWith(' / prepare') &&
      (!['queued', 'waiting', 'pending'].includes(job.status) ||
        (job.steps ?? []).some(
          (step) => step.status !== 'pending' && step.status !== 'queued'
        ))
  )
}

async function readKeys() {
  const response = await fetch(`${ISSUER}/.well-known/jwks`, {
    signal: AbortSignal.timeout(3000),
    redirect: 'error',
  })
  if (!response.ok) throw new Error('signing keys unavailable')
  return readJson(response.body, 65536)
}

function createAdmissionHandler({
  store,
  config,
  clock = Date.now,
  readKeys: keys = readKeys,
  verifyRun: eligible = verifyRun,
}) {
  if (
    config.repository !== 'uzh-bf/klicker-uzh' ||
    typeof config.repositoryId !== 'string' ||
    !/^[1-9]\d{0,19}$/.test(config.repositoryId) ||
    typeof config.groupId !== 'string' ||
    !/^[1-9]\d{0,19}$/.test(config.groupId) ||
    !Array.isArray(config.selectedWorkflows) ||
    config.selectedWorkflows.length > 8 ||
    !config.selectedWorkflows.includes(WORKFLOW) ||
    new Set(config.selectedWorkflows).size !==
      config.selectedWorkflows.length ||
    config.selectedWorkflows.some(
      (workflow) =>
        typeof workflow !== 'string' ||
        !workflow.startsWith('uzh-bf/klicker-uzh/.github/workflows/')
    ) ||
    config.workflowRef !== WORKFLOW ||
    config.audience !== AUDIENCE
  )
    throw new Error('invalid coordinator trust configuration')
  return async (request) => {
    const response = (status, body) =>
      Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
    if (new URL(request.url).pathname !== '/admit' || request.method !== 'POST')
      return response(404, { reason: 'not-found' })
    try {
      if (request.headers.get('content-type') !== 'application/json')
        return response(400, { reason: 'invalid-request' })
      const authorization = request.headers.get('authorization') ?? ''
      if (!authorization.startsWith('Bearer '))
        return response(403, { reason: 'denied' })
      const identity = await readJson(request.body, 4096)
      validateIdentity(identity)
      const jwks = await keys()
      const token = authorization.slice(7)
      verifyToken(token, jwks, config, identity, clock())
      if (!(await eligible(identity, config)))
        return response(403, { reason: 'denied' })
      verifyToken(token, jwks, config, identity, clock())
      const result = store.reserve(identity, clock())
      return response(
        result.ticket ? 200 : 409,
        result.ticket ? result : { reason: 'unavailable' }
      )
    } catch {
      // Never echo tokens, forge payloads, private amounts or local paths.
      return response(503, { reason: 'unavailable' })
    }
  }
}

async function main(argv = process.argv.slice(2)) {
  const [command, filename, configFile] = argv
  if (
    !['init', 'billing', 'reconcile', 'disable', 'status', 'serve'].includes(
      command
    ) ||
    !filename ||
    argv.length !== (command === 'serve' ? 3 : 2)
  )
    throw new Error(
      'expected <init|billing|reconcile|disable|status|serve> <private-db> [private-config]'
    )
  const store = new AdmissionStore(filename)
  if (command === 'serve') {
    store.status()
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'))
    const handler = createAdmissionHandler({ store, config })
    const server = http.createServer(
      { requestTimeout: 15000, headersTimeout: 5000, maxHeaderSize: 18000 },
      async (req, res) => {
        try {
          if (req.method !== 'POST' || req.url !== '/admit') {
            res.writeHead(404)
            res.end()
            return
          }
          const body = await readJson(req, 4096)
          const request = new Request('http://localhost/admit', {
            method: 'POST',
            headers: {
              authorization: req.headers.authorization ?? '',
              'content-type': req.headers['content-type'] ?? '',
            },
            body: JSON.stringify(body),
          })
          const response = await handler(request)
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        } catch {
          res.writeHead(400)
          res.end()
        }
      }
    )
    // Exposure and TLS are deliberately owned by a later deployment packet.
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(8080, '127.0.0.1', resolve)
      })
    } catch (error) {
      store.close()
      throw error
    }
    server.once('close', () => store.close())
    return server
  }
  try {
    if (command === 'init') store.initialize(await readJson(process.stdin))
    if (command === 'billing')
      store.recordBilling(await readJson(process.stdin))
    if (command === 'reconcile') {
      const input = await readJson(process.stdin)
      store.reconcile(input.identity, input.receipt)
    }
    if (command === 'disable') store.disable()
    if (command === 'status')
      process.stdout.write(`${JSON.stringify(store.status())}\n`)
  } finally {
    store.close()
  }
}

if (require.main === module)
  main().catch(() => {
    console.error(
      'Admission operation failed; inspect private configuration and state.'
    )
    process.exitCode = 1
  })
module.exports = { createAdmissionHandler, verifyRun, verifyToken, main }

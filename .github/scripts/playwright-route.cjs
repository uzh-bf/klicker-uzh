const fs = require('node:fs')

const { isSyncBranch } = require('./draft-sync-prs.cjs')

const ROUTE_SCHEMA_VERSION = 1

function fail(message) {
  throw new Error(message)
}

function exactCanaryMatch(value, pullRequestNumber) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === String(pullRequestNumber)
  )
}

function admittedWarpbuildAttempt(input) {
  const raw = input.warpbuildAdmissions
  if (
    input.repository !== 'uzh-bf/klicker-uzh' ||
    typeof raw !== 'string' ||
    raw.length > 4096 ||
    !raw
  )
    return ''
  const now = Date.parse(input.now ?? new Date().toISOString())
  if (!Number.isFinite(now)) return ''
  const identity = [
    'runId',
    'runAttempt',
    'pullRequestNumber',
    'headSha',
    'baseSha',
    'controlSha',
  ]
  try {
    const tickets = JSON.parse(raw)
    if (!Array.isArray(tickets) || tickets.length > 3) return ''
    const seen = new Set()
    for (const ticket of tickets) {
      if (!ticket || typeof ticket !== 'object' || Array.isArray(ticket))
        return ''
      if (
        Object.keys(ticket).sort().join(',') !==
        [...identity, 'expiresAt'].sort().join(',')
      )
        return ''
      for (const key of identity) {
        const pattern = key.endsWith('Sha') ? /^[a-f0-9]{40}$/ : /^[1-9]\d*$/
        if (typeof ticket[key] !== 'string' || !pattern.test(ticket[key]))
          return ''
      }
      const expiry =
        typeof ticket.expiresAt === 'string'
          ? Date.parse(ticket.expiresAt)
          : NaN
      if (
        !Number.isFinite(expiry) ||
        expiry <= now ||
        expiry > now + 4 * 60 * 60 * 1000
      )
        return ''
      const key = `${ticket.runId}:${ticket.runAttempt}`
      if (seen.has(key)) return ''
      seen.add(key)
    }
    const match = tickets.find((ticket) =>
      identity.every((key) => ticket[key] === input[key])
    )
    return match?.runAttempt ?? ''
  } catch {
    // Invalid operator configuration retains the existing execution backend.
    return ''
  }
}

function choosePlaywrightRoute(input) {
  const {
    eventName,
    repository,
    repositoryPrivate,
    headRepository,
    prAuthor,
    prDraft,
    headRef,
    pullRequestNumber,
    publicRolloutEnabled,
    publicRolloutCanaryPr,
    smartDraftEnabled,
    smartDraftCanaryPr,
    forceHostedCanaryPr,
    requestedRoute = 'auto',
  } = input

  const normalizedRequestedRoute =
    typeof requestedRoute === 'string'
      ? requestedRoute.trim() || 'auto'
      : requestedRoute
  if (normalizedRequestedRoute !== 'auto') {
    fail(`unsupported requested route ${JSON.stringify(requestedRoute)}`)
  }
  if (eventName !== 'pull_request' && eventName !== 'push') {
    fail(`unsupported event ${JSON.stringify(eventName)}`)
  }

  if (eventName === 'push') {
    return {
      schemaVersion: ROUTE_SCHEMA_VERSION,
      route: 'hosted',
      selectorPrState: 'ready',
      reasonCodes: ['push'],
    }
  }

  const reasons = []
  const nonEmptyString = (value) =>
    typeof value === 'string' && value.trim().length > 0
  const validRepository = nonEmptyString(repository)
  const validHeadRepository = nonEmptyString(headRepository)
  const validAuthor = nonEmptyString(prAuthor)
  const validPullRequestNumber =
    typeof pullRequestNumber === 'string' &&
    /^[1-9]\d*$/.test(pullRequestNumber)
  const samePublicRepository =
    repositoryPrivate === 'false' &&
    validRepository &&
    validHeadRepository &&
    headRepository === repository
  const bot =
    typeof prAuthor === 'string' && prAuthor.toLowerCase().endsWith('[bot]')
  const validDraft = prDraft === 'true' || prDraft === 'false'
  const forceHosted = exactCanaryMatch(forceHostedCanaryPr, pullRequestNumber)
  const publicRollout =
    publicRolloutEnabled === 'true' ||
    exactCanaryMatch(publicRolloutCanaryPr, pullRequestNumber)
  const smartDraft =
    smartDraftEnabled === 'true' ||
    exactCanaryMatch(smartDraftCanaryPr, pullRequestNumber)

  if (!validRepository || !validHeadRepository) {
    reasons.push('invalid-repository')
  }
  if (!validAuthor) reasons.push('invalid-author')
  if (!validPullRequestNumber) reasons.push('invalid-pull-request')
  if (repositoryPrivate !== 'false') reasons.push('private-repository')
  if (headRepository !== repository) reasons.push('fork')
  if (bot) reasons.push('bot')
  if (!validDraft) reasons.push('invalid-draft-state')

  const publicEligible =
    samePublicRepository &&
    validAuthor &&
    validPullRequestNumber &&
    !bot &&
    validDraft
  if (forceHosted) reasons.push('force-hosted-canary')

  // A draft runs the change-based plan only when an operator enables the
  // smart-draft control and the pull request passes the eligibility rules the
  // public route applies. Drafts stay on the hosted route, so they never take
  // public runner slots from ready pull requests. The force-hosted canary and
  // every unset, malformed or unmatched control keep the ready-state full plan.
  if (prDraft === 'true') {
    reasons.push(smartDraft ? 'smart-draft-enabled' : 'smart-draft-disabled')
  }
  // A draft sync pull request defers Playwright to its ready transition. The
  // controller advances the draft after every source push, so validating each
  // intermediate head would repeat the suite for heads that are never merged.
  if (
    prDraft === 'true' &&
    validRepository &&
    headRepository === repository &&
    isSyncBranch(headRef)
  ) {
    reasons.push('draft-sync-deferred')
    return {
      schemaVersion: ROUTE_SCHEMA_VERSION,
      route: 'hosted',
      selectorPrState: 'deferred',
      reasonCodes: [...new Set(reasons)].sort(),
    }
  }
  const smartDraftApplies =
    prDraft === 'true' && publicEligible && smartDraft && !forceHosted
  const publicReady =
    prDraft === 'false' && publicEligible && publicRollout && !forceHosted
  if (publicReady) reasons.push('public-pr-rollout')
  else reasons.push('hosted-fallback')

  const admissionAttempt = publicReady ? admittedWarpbuildAttempt(input) : ''

  return {
    schemaVersion: ROUTE_SCHEMA_VERSION,
    route: publicReady ? 'public-pr' : 'hosted',
    ...(admissionAttempt ? { provider: 'warpbuild', admissionAttempt } : {}),
    selectorPrState: smartDraftApplies ? 'draft' : 'ready',
    reasonCodes: [...new Set(reasons)].sort(),
  }
}

function envInput(env = process.env) {
  return {
    eventName: env.EVENT_NAME,
    repository: env.REPOSITORY,
    repositoryPrivate: env.REPOSITORY_PRIVATE,
    headRepository: env.HEAD_REPOSITORY,
    prAuthor: env.PR_AUTHOR,
    prDraft: env.PR_DRAFT,
    headRef: env.HEAD_REF ?? '',
    pullRequestNumber: env.PR_NUMBER,
    publicRolloutEnabled: env.PUBLIC_ROLLOUT_ENABLED ?? '',
    publicRolloutCanaryPr: env.PUBLIC_ROLLOUT_CANARY_PR ?? '',
    smartDraftEnabled: env.SMART_DRAFT_ENABLED ?? '',
    smartDraftCanaryPr: env.SMART_DRAFT_CANARY_PR ?? '',
    forceHostedCanaryPr: env.FORCE_HOSTED_CANARY_PR ?? '',
    requestedRoute: env.ROUTE_HINT ?? 'auto',
    warpbuildAdmissions: env.WARPBUILD_ADMISSIONS ?? '',
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
    headSha: env.HEAD_SHA,
    baseSha: env.BASE_SHA,
    controlSha: env.CONTROL_SHA,
  }
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--output' || !argv[1]) {
    fail('expected --output <path>')
  }
  return { output: argv[1] }
}

async function admissionJson(response, maximum) {
  if (!response.ok) throw new Error('admission unavailable')
  let length = 0
  const chunks = []
  for await (const chunk of response.body) {
    length += chunk.length
    if (length > maximum) throw new Error('admission response too large')
    chunks.push(Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function chooseRouteWithAdmission(
  input,
  env = process.env,
  network = fetch
) {
  const ordinary = choosePlaywrightRoute(input)
  if (
    ordinary.route !== 'public-pr' ||
    ordinary.provider === 'warpbuild' ||
    input.runAttempt !== '1' ||
    !env.WARPBUILD_ADMISSION_URL ||
    !env.ACTIONS_ID_TOKEN_REQUEST_URL ||
    !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  )
    return ordinary
  try {
    const endpoint = new URL(env.WARPBUILD_ADMISSION_URL)
    const tokenUrl = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL)
    if (
      endpoint.protocol !== 'https:' ||
      endpoint.pathname !== '/admit' ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      tokenUrl.protocol !== 'https:' ||
      !tokenUrl.hostname.endsWith('.actions.githubusercontent.com') ||
      tokenUrl.username ||
      tokenUrl.password ||
      tokenUrl.hash
    )
      return ordinary
    tokenUrl.searchParams.set('audience', 'klicker-playwright-admission')
    const signal = AbortSignal.timeout(12000)
    const tokenResponse = await network(tokenUrl, {
      signal,
      redirect: 'error',
      headers: {
        authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
      },
    })
    const { value } = await admissionJson(tokenResponse, 20000)
    if (typeof value !== 'string' || !value || value.length > 16384)
      return ordinary
    const identity = Object.fromEntries(
      [
        'runId',
        'runAttempt',
        'pullRequestNumber',
        'headSha',
        'baseSha',
        'controlSha',
      ].map((key) => [key, input[key]])
    )
    const response = await network(endpoint, {
      method: 'POST',
      signal,
      redirect: 'error',
      headers: {
        authorization: `Bearer ${value}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(identity),
    })
    const { ticket } = await admissionJson(response, 4096)
    return choosePlaywrightRoute({
      ...input,
      warpbuildAdmissions: JSON.stringify([ticket]),
    })
  } catch {
    // An absent response cannot prove that no reservation was made. The
    // coordinator retains that exposure while this run keeps ordinary routing.
    return ordinary
  }
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const { output } = parseArgs(argv)
  const route = await chooseRouteWithAdmission(envInput(env), env)
  fs.writeFileSync(output, `${JSON.stringify(route, null, 2)}\n`)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Playwright route selection failed: ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = {
  ROUTE_SCHEMA_VERSION,
  choosePlaywrightRoute,
  chooseRouteWithAdmission,
  envInput,
}

const fs = require('node:fs')

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

function choosePlaywrightRoute(input) {
  const {
    eventName,
    repository,
    repositoryPrivate,
    headRepository,
    prAuthor,
    prDraft,
    pullRequestNumber,
    publicRolloutEnabled,
    publicRolloutCanaryPr,
    smartDraftEnabled,
    smartDraftCanaryPr,
    forceHostedCanaryPr,
    requestedRoute = 'auto',
  } = input

  if (requestedRoute !== 'auto') {
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
  const samePublicRepository =
    repositoryPrivate === 'false' && headRepository === repository
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

  if (repositoryPrivate !== 'false') reasons.push('private-repository')
  if (headRepository !== repository) reasons.push('fork')
  if (bot) reasons.push('bot')
  if (!validDraft) reasons.push('invalid-draft-state')

  const publicEligible = samePublicRepository && !bot && validDraft
  if (forceHosted) reasons.push('force-hosted-canary')

  if (prDraft === 'true' && publicEligible && smartDraft) {
    reasons.push('smart-draft-enabled')
    return {
      schemaVersion: ROUTE_SCHEMA_VERSION,
      route: publicRollout && !forceHosted ? 'public-pr' : 'hosted',
      selectorPrState: 'draft',
      reasonCodes: [
        ...reasons,
        publicRollout && !forceHosted ? 'public-pr-rollout' : 'hosted-fallback',
      ].sort(),
    }
  }

  if (prDraft === 'true') reasons.push('smart-draft-disabled')
  const publicReady =
    prDraft === 'false' && publicEligible && publicRollout && !forceHosted
  if (publicReady) reasons.push('public-pr-rollout')
  else reasons.push('hosted-fallback')

  return {
    schemaVersion: ROUTE_SCHEMA_VERSION,
    route: publicReady ? 'public-pr' : 'hosted',
    selectorPrState: 'ready',
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
    pullRequestNumber: env.PR_NUMBER,
    publicRolloutEnabled: env.PUBLIC_ROLLOUT_ENABLED ?? '',
    publicRolloutCanaryPr: env.PUBLIC_ROLLOUT_CANARY_PR ?? '',
    smartDraftEnabled: env.SMART_DRAFT_ENABLED ?? '',
    smartDraftCanaryPr: env.SMART_DRAFT_CANARY_PR ?? '',
    forceHostedCanaryPr: env.FORCE_HOSTED_CANARY_PR ?? '',
    requestedRoute: env.ROUTE_HINT ?? 'auto',
  }
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--output' || !argv[1]) {
    fail('expected --output <path>')
  }
  return { output: argv[1] }
}

function main(argv = process.argv.slice(2), env = process.env) {
  const { output } = parseArgs(argv)
  const route = choosePlaywrightRoute(envInput(env))
  fs.writeFileSync(output, `${JSON.stringify(route, null, 2)}\n`)
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`Playwright route selection failed: ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = {
  ROUTE_SCHEMA_VERSION,
  choosePlaywrightRoute,
  envInput,
}

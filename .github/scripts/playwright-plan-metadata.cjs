const fs = require('node:fs')

const { CHANGE_CLASS, isKnownClass } = require('./minimum-validation-class.cjs')
const { chooseRouteWithAdmission, envInput } = require('./playwright-route.cjs')

const PLAN_SCHEMA_VERSION = 1

function fail(message) {
  throw new Error(message)
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`could not parse ${label} at ${filePath}: ${error.message}`)
  }
}

function buildPlanMetadata(plan, routeDecision) {
  if (!plan || plan.schemaVersion !== PLAN_SCHEMA_VERSION) {
    fail(`unsupported Playwright plan schema ${plan?.schemaVersion}`)
  }
  if (!['skip', 'selected', 'full'].includes(plan.mode)) {
    fail(`unsupported Playwright plan mode ${plan.mode}`)
  }
  if (!Number.isInteger(plan.shardCount) || plan.shardCount < 0) {
    fail('Playwright plan shard count must be a non-negative integer')
  }
  if (plan.mode === 'skip' && plan.shardCount !== 0) {
    fail('skip Playwright plans must not contain shards')
  }
  if (plan.mode !== 'skip' && plan.shardCount === 0) {
    fail('non-skip Playwright plans must contain at least one shard')
  }
  if (!['hosted', 'public-pr'].includes(routeDecision?.route)) {
    fail(`unsupported Playwright route ${routeDecision?.route}`)
  }
  if (!['draft', 'ready', 'deferred'].includes(routeDecision.selectorPrState)) {
    fail(
      `unsupported selector pull-request state ${routeDecision.selectorPrState}`
    )
  }
  const provider =
    routeDecision.provider ??
    (routeDecision.route === 'hosted' ? 'github' : 'public-pool')
  if (
    !['github', 'public-pool', 'warpbuild'].includes(provider) ||
    (routeDecision.route === 'hosted'
      ? provider !== 'github'
      : provider === 'github')
  ) {
    fail('unsupported execution provider for the trust route')
  }
  const cloud = provider === 'warpbuild'
  const admissionAttempt = cloud ? routeDecision.admissionAttempt : ''
  if (
    cloud &&
    (routeDecision.selectorPrState !== 'ready' ||
      typeof admissionAttempt !== 'string' ||
      !/^[1-9]\d*$/.test(admissionAttempt))
  ) {
    fail('cloud provider requires a ready plan and an admitted attempt')
  }
  const runner = (role, size) =>
    cloud
      ? { group: 'Default', labels: `warp-ubuntu-2404-arm64-${size}x` }
      : {
          group: 'public-pr-arm64',
          labels: [
            'linux',
            'arm64',
            'docker',
            'public-pr-arm64',
            'playwright',
            role,
          ],
        }
  if (routeDecision.selectorPrState === 'deferred' && plan.mode !== 'skip') {
    fail('deferred execution must use the skip Playwright plan')
  }

  // Every plan carries the change class the trusted classifier proved for the
  // same diff. An unknown or absent class is a failure rather than an implicit
  // narrow envelope, and only the bounded classes may narrow the ready state.
  const envelopeClass = plan.envelopeClass
  if (!isKnownClass(envelopeClass)) {
    fail(`unsupported change class ${JSON.stringify(envelopeClass ?? null)}`)
  }
  const boundedEnvelope = envelopeClass !== CHANGE_CLASS.application

  if (
    routeDecision.selectorPrState === 'ready' &&
    !boundedEnvelope &&
    plan.mode !== 'full'
  ) {
    fail('ready execution must use the full Playwright plan')
  }

  if (
    routeDecision.selectorPrState === 'ready' &&
    !boundedEnvelope &&
    plan.shardCount !== 8
  ) {
    fail('ready execution must use exactly eight Playwright shards')
  }

  if (!Array.isArray(plan.shards) || plan.shards.length !== plan.shardCount) {
    fail('Playwright plan shard count does not match its shard list')
  }

  const include = plan.shards.map((shard) => {
    if (
      !Number.isInteger(shard.shardIndex) ||
      !Number.isInteger(shard.shardTotal) ||
      shard.shardIndex < 1 ||
      shard.shardIndex > shard.shardTotal ||
      shard.shardTotal !== plan.shardCount ||
      !Array.isArray(shard.files) ||
      shard.files.length === 0
    ) {
      fail('Playwright plan contains an invalid shard')
    }
    return {
      shardIndex: shard.shardIndex,
      shardTotal: shard.shardTotal,
    }
  })

  const shardIndices = include.map((shard) => shard.shardIndex)
  if (new Set(shardIndices).size !== shardIndices.length) {
    fail('Playwright plan contains duplicate shard indices')
  }
  for (let index = 1; index <= plan.shardCount; index++) {
    if (!shardIndices.includes(index)) {
      fail(`Playwright plan is missing shard ${index}`)
    }
  }

  const reasonCodes = Array.isArray(plan.reasonCodes) ? plan.reasonCodes : []
  if (
    !reasonCodes.every(
      (code) =>
        typeof code === 'string' &&
        code.trim().length > 0 &&
        !/[\r\n]/.test(code)
    )
  ) {
    fail('Playwright plan reason codes must be non-empty single-line strings')
  }

  return {
    route: routeDecision.route,
    provider,
    admissionAttempt,
    buildRunner: runner('playwright-build', 8),
    shardRunner: runner('playwright-shard', 4),
    jobTimeout: cloud ? 45 : 120,
    mode: plan.mode,
    envelopeClass,
    selectorPrState: routeDecision.selectorPrState,
    shouldRun: plan.mode !== 'skip',
    shardMatrix: { include },
    reasonCodes,
  }
}

function writeGithubOutputs(metadata, outputPath) {
  const lines = [
    `route=${metadata.route}`,
    `provider=${metadata.provider}`,
    `admission_attempt=${metadata.admissionAttempt}`,
    `build_runner=${JSON.stringify(metadata.buildRunner)}`,
    `shard_runner=${JSON.stringify(metadata.shardRunner)}`,
    `job_timeout=${metadata.jobTimeout}`,
    `mode=${metadata.mode}`,
    `envelope_class=${metadata.envelopeClass}`,
    `selector_pr_state=${metadata.selectorPrState}`,
    `should_run=${metadata.shouldRun}`,
    `shard_matrix=${JSON.stringify(metadata.shardMatrix)}`,
    `reason_codes=${metadata.reasonCodes.join(',')}`,
  ]
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`)
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index++) {
    const option = argv[index]
    if (!option.startsWith('--') || index + 1 >= argv.length) {
      fail(`expected option value, got ${option}`)
    }
    args[option.slice(2)] = argv[++index]
  }
  for (const key of ['plan', 'route', 'output']) {
    if (!args[key]) fail(`missing --${key}`)
  }
  return args
}

async function main(
  argv = process.argv.slice(2),
  env = process.env,
  network = fetch
) {
  const args = parseArgs(argv)
  const plan = readJson(args.plan, 'Playwright plan')
  let route = readJson(args.route, 'Playwright route decision')
  let metadata = buildPlanMetadata(plan, route)
  // Validate the entire plan before a request can reserve paid capacity.
  if (metadata.shouldRun && env.WARPBUILD_ADMISSION_URL) {
    route = await chooseRouteWithAdmission(envInput(env), env, network)
    metadata = buildPlanMetadata(plan, route)
    fs.writeFileSync(args.route, `${JSON.stringify(route, null, 2)}\n`)
  }
  writeGithubOutputs(metadata, args.output)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Playwright plan metadata failed: ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = {
  main,
  PLAN_SCHEMA_VERSION,
  buildPlanMetadata,
  writeGithubOutputs,
}

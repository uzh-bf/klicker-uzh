'use strict'

const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const {
  CONSOLIDATED_WORKFLOW_PATH,
  PREVIEW_IMAGE_TARGETS,
  PREVIEW_LOGICAL_TARGETS,
  PREVIEW_STAGING_IMAGES,
} = require('./staging-image-targets.cjs')
const {
  canonicalJson,
  fingerprintTarget,
  trackedBlob,
} = require('./image-input-fingerprint.cjs')

const PREVIEW_PLAN_SCHEMA_VERSION = 1
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/
const CORRELATION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const ENVIRONMENT_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/
const DEPLOYMENT_CONFIG_ARGUMENT = 'KLICKER_DEPLOYMENT_BUILD_ENV_JSON'
const PREVIEW_PLATFORM_ARGUMENT = 'KLICKER_PREVIEW_PLATFORM'
const PREVIEW_DEPLOYMENT_APPS = Object.freeze({
  auth: 'auth',
  chat: 'chat',
  control: 'frontend-control',
  manage: 'frontend-manage',
  pwa: 'frontend-pwa',
})
const PLATFORMS = Object.freeze({
  'linux/amd64': { runner: 'ubuntu-latest', suffix: 'amd64' },
  'linux/arm64': { runner: 'ubuntu-24.04-arm', suffix: 'arm64' },
})

function fail(message) {
  throw new Error(`preview-image-plan: ${message}`)
}

function requiredText(label, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} is required`)
  }
  return value.trim()
}

function fullSha(label, value) {
  const sha = requiredText(label, value).toLowerCase()
  if (!GIT_SHA_PATTERN.test(sha)) {
    fail(`${label} must be a full 40-character commit SHA`)
  }
  return sha
}

function parseTargets(rawTargets) {
  const targets = requiredText('logical targets', rawTargets)
    .split(/[,\n]/)
    .map((target) => target.trim())
    .filter(Boolean)
  if (targets.length === 0) fail('at least one logical target is required')
  if (targets.some((target) => target === '*' || target === 'all')) {
    fail('wildcard target selection is not allowed')
  }
  return [...new Set(targets)]
}

function parsePlatform(value) {
  const platform = requiredText('platform', value)
  if (!Object.hasOwn(PLATFORMS, platform)) {
    fail(`platform must be one of ${Object.keys(PLATFORMS).join(', ')}`)
  }
  return platform
}

function normalizeConfigurationValue(value) {
  if (Array.isArray(value)) return value.map(normalizeConfigurationValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeConfigurationValue(value[key])])
    )
  }
  return value
}

function configurationDigest(value) {
  const canonical =
    typeof value === 'string'
      ? value
      : canonicalJson(normalizeConfigurationValue(value))
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`
}

function targetKey(target, digest) {
  return `target:${target}:config:${digest}`
}

function isoWeek(date) {
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((utc - yearStart) / 86_400_000 + 1) / 7)
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function assertPublicEnvironment(environment) {
  if (
    environment === null ||
    typeof environment !== 'object' ||
    Array.isArray(environment)
  ) {
    fail('each target configuration must be a JSON object')
  }
  for (const [name, value] of Object.entries(environment)) {
    if (!ENVIRONMENT_NAME_PATTERN.test(name)) {
      fail(`target configuration contains an invalid environment name: ${name}`)
    }
    if (typeof value !== 'string') fail(`${name} must be a string`)
    if (/(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|CREDENTIAL)/i.test(name)) {
      fail(`${name} is not public build configuration`)
    }
    if (value.includes(String.fromCharCode(0)) || /[\r\n]/.test(value)) {
      fail(`${name} must not contain NUL or a line break`)
    }
  }
}

async function loadDeploymentHelper(controlRoot) {
  const helperPath = path.join(controlRoot, 'util/deployment-build-env.mjs')
  if (!fs.existsSync(helperPath)) {
    fail('trusted deployment build configuration validator is unavailable')
  }
  try {
    return await import(`${pathToFileURL(helperPath).href}?preview-plan=1`)
  } catch (error) {
    fail(
      `trusted deployment build validator could not be loaded: ${error.message}`
    )
  }
}

async function normalizeTargetConfiguration({
  deploymentHelper,
  environment,
  target,
}) {
  assertPublicEnvironment(environment)
  const normalized = normalizeConfigurationValue(environment)
  const deploymentApp = PREVIEW_DEPLOYMENT_APPS[target]
  if (deploymentApp) {
    const rawDeployment = normalized[DEPLOYMENT_CONFIG_ARGUMENT]
    if (typeof rawDeployment !== 'string' || rawDeployment.trim() === '') {
      fail(`${target} requires ${DEPLOYMENT_CONFIG_ARGUMENT}`)
    }
    let parsedDeployment
    try {
      parsedDeployment = JSON.parse(rawDeployment)
    } catch {
      fail(`${target} ${DEPLOYMENT_CONFIG_ARGUMENT} must contain JSON`)
    }
    const canonicalDeployment = canonicalJson(
      normalizeConfigurationValue(parsedDeployment)
    )
    try {
      deploymentHelper.parseDeploymentBuildEnv(
        canonicalDeployment,
        deploymentApp
      )
    } catch (error) {
      fail(`${target} deployment configuration is invalid: ${error.message}`)
    }
  }

  const canonical = canonicalJson(normalized)
  const digest = configurationDigest(canonical)
  return {
    digest,
    environment: JSON.parse(canonical),
    json: canonical,
    key: targetKey(target, digest),
  }
}

async function parseBuildConfigurationMap(rawValue, controlRoot, knownTargets) {
  const raw = requiredText('build configuration JSON', rawValue)
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    fail('build configuration must contain valid JSON')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('build configuration must map targets to configuration objects')
  }
  const unknown = Object.keys(parsed).filter(
    (target) => !knownTargets.has(target)
  )
  if (unknown.length > 0)
    fail(`unknown configured target(s): ${unknown.join(', ')}`)

  const deploymentHelper = await loadDeploymentHelper(controlRoot)
  const configurations = new Map()
  for (const [target, environment] of Object.entries(parsed)) {
    configurations.set(
      target,
      await normalizeTargetConfiguration({
        deploymentHelper,
        environment,
        target,
      })
    )
  }
  return configurations
}

async function validateDispatchInputs({
  buildConfigurationJson,
  controlRevision,
  controlRoot,
  correlationId,
  eventName,
  platform,
  sourceRevision,
  targets,
}) {
  if (eventName !== 'workflow_dispatch') {
    fail('preview planning requires a workflow_dispatch event')
  }
  const selectedTargets = parseTargets(targets)
  const knownTargets = new Set(
    PREVIEW_LOGICAL_TARGETS.map((entry) => entry.logicalTarget)
  )
  const unknownTargets = selectedTargets.filter(
    (target) => !knownTargets.has(target)
  )
  if (unknownTargets.length > 0) {
    fail(`unknown logical target(s): ${unknownTargets.join(', ')}`)
  }

  const normalizedCorrelation = requiredText('correlation ID', correlationId)
  if (!CORRELATION_PATTERN.test(normalizedCorrelation)) {
    fail(
      'correlation ID must use 1-128 letters, numbers, dots, underscores or hyphens'
    )
  }
  if (normalizedCorrelation.length > 100) {
    fail(
      'correlation ID must be at most 100 characters for its preview cache tag'
    )
  }
  const configurations = await parseBuildConfigurationMap(
    buildConfigurationJson,
    controlRoot,
    knownTargets
  )
  const unconfigured = selectedTargets.filter(
    (target) => !configurations.has(target)
  )
  if (unconfigured.length > 0) {
    fail(`build configuration is missing target(s): ${unconfigured.join(', ')}`)
  }

  return {
    configurations,
    controlRevision: fullSha('control revision', controlRevision),
    correlationId: normalizedCorrelation,
    platform: parsePlatform(platform),
    sourceRevision: fullSha('source revision', sourceRevision),
    targets: selectedTargets,
  }
}

function targetByLogicalName(logicalTarget) {
  const entry = PREVIEW_LOGICAL_TARGETS.find(
    (candidate) => candidate.logicalTarget === logicalTarget
  )
  if (!entry) fail(`unknown logical target ${logicalTarget}`)
  return entry.target
}

function stagingImageFor(logicalTarget) {
  return (
    PREVIEW_STAGING_IMAGES.find(
      (entry) => entry.logicalTarget === logicalTarget
    ) ?? null
  )
}

function previewTag(sourceRevision, platform, digest) {
  const tag = `preview-${sourceRevision}-${PLATFORMS[platform].suffix}-${digest.slice(7)}`
  if (tag.length > 128) fail(`preview image tag is too long: ${tag}`)
  return tag
}

function configurationBuildArguments(configuration, platform) {
  return [
    ...Object.entries(configuration.environment).map(
      ([name, value]) => `${name}=${value}`
    ),
    `${PREVIEW_PLATFORM_ARGUMENT}=${platform}`,
  ]
}

function matrixEntry(
  target,
  {
    cacheEpoch,
    configuration,
    correlationId,
    logicalTargets,
    platform,
    sourceRevision,
  }
) {
  const platformInfo = PLATFORMS[platform]
  const staging = stagingImageFor(logicalTargets[0])
  return {
    buildArtifact: `preview-build-${target.id}`,
    buildArgs: configurationBuildArguments(configuration, platform).join('\n'),
    configuration: JSON.stringify(configuration.environment),
    configurationDigest: configuration.digest,
    correlationId,
    dockerfile: target.dockerfile,
    id: target.id,
    image: target.image,
    jobName: `preview-${target.id}-${platformInfo.suffix}`,
    logicalTargets: JSON.stringify(logicalTargets),
    platform,
    platformSuffix: platformInfo.suffix,
    scanArtifact: `preview-scan-${target.id}`,
    stagingCacheRef:
      platform === 'linux/arm64' && staging
        ? `${target.stagingImage}-arm:buildcache-trusted-${cacheEpoch}`
        : '',
    stagingImage: target.stagingImage ?? '',
    tag: previewTag(sourceRevision, platform, configuration.digest),
    targetKey: configuration.key,
    usesDeploymentConfig: target.usesDeploymentConfig === true,
  }
}

function resolvePreviewImages({
  configurations,
  controlRevision,
  correlationId,
  platform,
  sourceRevision,
  sourceRoot,
  targets,
}) {
  const selectedByPhysical = new Map()
  for (const logicalTarget of targets) {
    const target = targetByLogicalName(logicalTarget)
    const configuration = configurations.get(logicalTarget)
    const current = selectedByPhysical.get(target.id) ?? {
      configuration,
      logicalTargets: [],
      target: { ...target },
    }
    if (
      current.configuration &&
      current.configuration.json !== configuration.json
    ) {
      fail(`targets sharing build ${target.id} require identical configuration`)
    }
    current.configuration = configuration
    current.logicalTargets.push(logicalTarget)
    selectedByPhysical.set(target.id, current)
  }

  for (const entry of selectedByPhysical.values()) {
    if (!fs.existsSync(path.join(sourceRoot, entry.target.dockerfile))) {
      fail(
        `${entry.target.id} Dockerfile is absent from the exact source revision`
      )
    }
  }

  const cacheEpoch = isoWeek(new Date())
  const entries = [...selectedByPhysical.values()]
    .sort((left, right) => left.target.id.localeCompare(right.target.id))
    .map((entry) =>
      matrixEntry(entry.target, {
        cacheEpoch,
        configuration: entry.configuration,
        correlationId,
        logicalTargets: entry.logicalTargets,
        platform,
        sourceRevision,
      })
    )
  const matrixBuild = entries
  return {
    schemaVersion: PREVIEW_PLAN_SCHEMA_VERSION,
    cacheEpoch,
    controlRevision,
    correlationId,
    expectedTargets: entries.map((entry) => entry.id),
    matrixBuild,
    platform,
    platformSuffix: PLATFORMS[platform].suffix,
    runner: PLATFORMS[platform].runner,
    scanMatrix: entries,
    selectedLogicalTargets: targets,
    sourceRevision,
    targetMap: entries.flatMap((entry) =>
      JSON.parse(entry.logicalTargets).map((logicalTarget) => ({
        buildArtifact: entry.buildArtifact,
        buildTarget: entry.id,
        configuration: JSON.parse(entry.configuration),
        configurationDigest: entry.configurationDigest,
        dockerfile: entry.dockerfile,
        image: entry.image,
        logicalTarget,
        platform: entry.platform,
        scanArtifact: entry.scanArtifact,
        tag: entry.tag,
        targetKey: targetKey(logicalTarget, entry.configurationDigest),
      }))
    ),
  }
}

function writeOutputs(outputs, outputPath = process.env.GITHUB_OUTPUT) {
  if (!outputPath) return
  const lines = Object.entries(outputs).map(([key, value]) => {
    if (typeof value === 'string' && /[\r\n]/.test(value)) {
      fail(`GitHub output ${key} must be single-line`)
    }
    return `${key}=${value}`
  })
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`)
}

function planOutputs(plan) {
  const boolean = (entries) => (entries.length > 0 ? 'true' : 'false')
  return {
    build: boolean(plan.matrixBuild),
    'build-matrix': JSON.stringify(plan.matrixBuild),
    'cache-epoch': plan.cacheEpoch,
    'configuration-digests': JSON.stringify(
      Object.fromEntries(
        plan.scanMatrix.map((entry) => [entry.id, entry.configurationDigest])
      )
    ),
    'control-revision': plan.controlRevision,
    'correlation-id': plan.correlationId,
    'expected-targets': JSON.stringify(plan.expectedTargets),
    platform: plan.platform,
    'platform-suffix': plan.platformSuffix,
    runner: plan.runner,
    'scan-build': boolean(plan.scanMatrix),
    'scan-matrix': JSON.stringify(plan.scanMatrix),
    'selected-logical-targets': JSON.stringify(plan.selectedLogicalTargets),
    'source-revision': plan.sourceRevision,
    'target-map': JSON.stringify(plan.targetMap),
  }
}

function formatSummary(plan) {
  return [
    '## Preview image plan',
    '',
    `- Source revision: \`${plan.sourceRevision}\``,
    `- Control revision: \`${plan.controlRevision}\``,
    `- Platform: \`${plan.platform}\``,
    `- Logical targets: ${plan.selectedLogicalTargets.join(', ')}`,
    `- Physical builds: ${plan.expectedTargets.join(', ')}`,
    `- Configured keys: ${plan.targetMap.map((entry) => entry.targetKey).join(', ')}`,
    '',
  ].join('\n')
}

function fingerprintPreviewTarget({
  configuration,
  configurationDigest: expectedDigest,
  platform,
  sourceRevision,
  sourceRoot,
  targetId,
  trustedRoot,
}) {
  const target = PREVIEW_IMAGE_TARGETS.find((entry) => entry.id === targetId)
  if (!target) fail(`unknown physical target ${targetId}`)
  const parsedConfiguration = JSON.parse(
    requiredText('target configuration', configuration)
  )
  const normalized = normalizeConfigurationValue(parsedConfiguration)
  const actualDigest = configurationDigest(normalized)
  if (expectedDigest && actualDigest !== expectedDigest) {
    fail('target configuration digest does not match the plan')
  }
  const buildArguments = configurationBuildArguments(
    { environment: normalized },
    parsePlatform(platform)
  )
  const fingerprint = fingerprintTarget({
    buildArguments,
    rootDirectory: sourceRoot,
    inspect: (reference) =>
      execFileSync(
        'docker',
        [
          'buildx',
          'imagetools',
          'inspect',
          reference,
          '--format',
          '{{json .Manifest}}',
        ],
        { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 }
      ),
    target,
    workflowBlob:
      trustedRoot === undefined
        ? undefined
        : trackedBlob({
            filePath: CONSOLIDATED_WORKFLOW_PATH,
            rootDirectory: trustedRoot,
          }),
    workflowPath: CONSOLIDATED_WORKFLOW_PATH,
  })
  return {
    ...fingerprint,
    configurationDigest: actualDigest,
    platform,
    tag: previewTag(sourceRevision, platform, actualDigest),
  }
}

function parseArguments(argv) {
  const [command, ...rest] = argv
  const args = {}
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index]
    const value = rest[index + 1]
    if (!flag?.startsWith('--') || value === undefined) {
      fail(`unexpected argument ${flag ?? ''}`)
    }
    args[flag.slice(2)] = value
  }
  return { args, command }
}

function dispatchEnvironment() {
  return {
    buildConfigurationJson: process.env.BUILD_CONFIGURATION_JSON,
    controlRevision: process.env.CONTROL_REVISION,
    controlRoot: process.env.CONTROL_ROOT,
    correlationId: process.env.CORRELATION_ID,
    eventName: process.env.EVENT_NAME,
    platform: process.env.PLATFORM,
    sourceRevision: process.env.SOURCE_REVISION,
    targets: process.env.TARGETS,
  }
}

async function main(argv = process.argv.slice(2)) {
  const { args, command } = parseArguments(argv)
  if (command === 'validate') {
    const controlRoot = path.resolve(args['control-root'] ?? process.cwd())
    const validated = await validateDispatchInputs({
      ...dispatchEnvironment(),
      controlRoot,
    })
    process.stdout.write(`${JSON.stringify({ targets: validated.targets })}\n`)
    return 0
  }
  if (command === 'resolve') {
    const controlRoot = path.resolve(args['control-root'] ?? process.cwd())
    const sourceRoot = path.resolve(args['source-root'])
    const validated = await validateDispatchInputs({
      ...dispatchEnvironment(),
      controlRoot,
    })
    const plan = resolvePreviewImages({ ...validated, sourceRoot })
    if (process.env.PLAN_PATH) {
      fs.writeFileSync(
        process.env.PLAN_PATH,
        `${JSON.stringify(plan, null, 2)}\n`
      )
    }
    writeOutputs(planOutputs(plan))
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatSummary(plan))
    }
    process.stdout.write(`${JSON.stringify(planOutputs(plan))}\n`)
    return 0
  }
  if (command === 'fingerprint') {
    const result = fingerprintPreviewTarget({
      configuration: args.configuration ?? process.env.TARGET_CONFIGURATION,
      configurationDigest: args['configuration-digest'],
      platform: args.platform,
      sourceRevision: fullSha('source revision', args['source-revision']),
      sourceRoot: path.resolve(args['source-root']),
      targetId: args.target,
      trustedRoot: args['trusted-root']
        ? path.resolve(args['trusted-root'])
        : undefined,
    })
    if (args.output) {
      fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`)
    }
    writeOutputs({ fingerprint: result.fingerprint, tag: result.tag })
    process.stdout.write(
      `${JSON.stringify({ fingerprint: result.fingerprint, tag: result.tag })}\n`
    )
    return 0
  }
  fail(`unknown command ${command ?? ''}`)
}

if (require.main === module) {
  main().then(
    (status) => {
      process.exitCode = status
    },
    (error) => {
      console.error(`::error::${error.message}`)
      process.exitCode = 1
    }
  )
}

module.exports = {
  PLATFORMS,
  PREVIEW_DEPLOYMENT_APPS,
  PREVIEW_PLAN_SCHEMA_VERSION,
  configurationDigest,
  fingerprintPreviewTarget,
  isoWeek,
  normalizeTargetConfiguration,
  parseBuildConfigurationMap,
  parseTargets,
  planOutputs,
  resolvePreviewImages,
  targetKey,
  validateDispatchInputs,
}

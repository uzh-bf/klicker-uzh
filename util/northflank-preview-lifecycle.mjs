import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const DEFAULT_PREVIEW_LIFECYCLE_LIMITS = Object.freeze({
  maxEnvironments: 2,
  maxBuildAttempts: 42,
  maxLifetimeMs: 48 * 60 * 60 * 1000,
})

const PREVIEW_GRAPH = JSON.parse(
  readFileSync(
    new URL('../deploy/northflank/klicker-preview.json', import.meta.url),
    'utf8'
  )
)
const PREVIEW_ARGUMENT_REFERENCE = /\$\{args\.([A-Za-z0-9_.]+)\}/g
const PREVIEW_SKIP_KEYS = Object.keys(PREVIEW_GRAPH.arguments.skip)
const PREVIEW_SKIP_BY_NORMALIZED_BINDING = new Map(
  PREVIEW_SKIP_KEYS.map((key) => [key.replace(/[-_]/g, '').toLowerCase(), key])
)
const PREVIEW_SKIP_ALIASES = Object.freeze({ 'klicker-local-mcp': 'localMcp' })
const PREVIEW_ORIGIN_APPS = Object.freeze({
  APP_ORIGIN_API: 'api',
  APP_ORIGIN_AUTH: 'auth',
  APP_ORIGIN_MANAGE: 'manage',
  APP_ORIGIN_PWA: 'pwa',
  APP_ORIGIN_LTI: 'lti',
  APP_ORIGIN_ASSESSMENT_API: 'api',
  APP_ORIGIN_ASSESSMENT_PWA: 'pwa',
  NEXTAUTH_URL: 'auth',
})
const PREVIEW_PRODUCTION_DOMAIN_SUFFIXES = [
  'klicker.com',
  'klicker.stg.df-app.ch',
  'klicker.uzh.ch',
]

const GIT_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const NON_PROVIDER_RESOURCE_KINDS = new Set(['fixture-job', 'image'])

export class PreviewLifecycleError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = 'PreviewLifecycleError'
    this.code = code
    if (details !== undefined) this.details = details
  }
}

function fail(code, message, details) {
  throw new PreviewLifecycleError(code, message, details)
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertRecord(value, label) {
  if (!isRecord(value)) fail('INVALID_INPUT', `${label} must be an object`)
  return value
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_INPUT', `${label} must be a non-empty string`)
  }
  return value
}

function assertInteger(value, label, { min = 0, max } = {}) {
  if (
    !Number.isSafeInteger(value) ||
    value < min ||
    (max !== undefined && value > max)
  ) {
    fail(
      'INVALID_INPUT',
      `${label} must be an integer within its allowed range`
    )
  }
  return value
}

function assertTime(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    fail('INVALID_INPUT', `${label} must be a non-negative timestamp`)
  }
  return value
}

function assertSha(value, label) {
  if (typeof value !== 'string' || !GIT_SHA.test(value)) {
    fail('INVALID_INPUT', `${label} must be a full lowercase commit SHA`)
  }
  return value
}

function assertRepository(value, label) {
  if (typeof value !== 'string' || !REPOSITORY.test(value)) {
    fail('INVALID_INPUT', `${label} must use owner/repository form`)
  }
  return value
}

function optionalStringArray(value, label) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string')
  ) {
    fail('INVALID_INPUT', `${label} must be an array of strings`)
  }
  return value
}

function clone(value) {
  return structuredClone(value)
}

function sameSet(left, right) {
  const a = [...new Set(left)].sort()
  const b = [...new Set(right)].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function normalizeLimits(input = {}) {
  assertRecord(input, 'Lifecycle limits')
  const limits = {
    maxEnvironments:
      input.maxEnvironments ?? DEFAULT_PREVIEW_LIFECYCLE_LIMITS.maxEnvironments,
    maxBuildAttempts:
      input.maxBuildAttempts ??
      DEFAULT_PREVIEW_LIFECYCLE_LIMITS.maxBuildAttempts,
    maxLifetimeMs:
      input.maxLifetimeMs ?? DEFAULT_PREVIEW_LIFECYCLE_LIMITS.maxLifetimeMs,
  }
  assertInteger(limits.maxEnvironments, 'Maximum environments', {
    min: 1,
    max: DEFAULT_PREVIEW_LIFECYCLE_LIMITS.maxEnvironments,
  })
  assertInteger(limits.maxBuildAttempts, 'Maximum build attempts', {
    min: 0,
    max: DEFAULT_PREVIEW_LIFECYCLE_LIMITS.maxBuildAttempts,
  })
  assertInteger(limits.maxLifetimeMs, 'Maximum lifetime', {
    min: 1,
    max: DEFAULT_PREVIEW_LIFECYCLE_LIMITS.maxLifetimeMs,
  })
  return Object.freeze(limits)
}

export function createPreviewLifecycleState({
  startedAt = Date.now(),
  deadline,
  limits = {},
} = {}) {
  const start = assertTime(startedAt, 'Trial start')
  const normalized = normalizeLimits(limits)
  const end = assertTime(
    deadline ?? start + normalized.maxLifetimeMs,
    'Trial deadline'
  )
  if (end <= start || end - start > normalized.maxLifetimeMs) {
    fail(
      'INVALID_DEADLINE',
      'Trial deadline must be after the start and within the configured lifetime'
    )
  }
  return {
    schemaVersion: 1,
    trial: {
      startedAt: start,
      deadline: end,
      limits: { ...normalized },
      buildAttempts: 0,
      attemptRecords: [],
    },
    environments: {},
    terminalIdentities: {},
  }
}

function validateState(input) {
  const state = assertRecord(input, 'Lifecycle state')
  if (state.schemaVersion !== 1) {
    fail('INVALID_STATE', 'Lifecycle state must use schemaVersion 1')
  }
  const trial = assertRecord(state.trial, 'Trial state')
  assertTime(trial.startedAt, 'Trial start')
  assertTime(trial.deadline, 'Trial deadline')
  const limits = normalizeLimits(trial.limits)
  for (const [name, value] of Object.entries(limits)) {
    if (trial.limits[name] !== value) {
      fail('INVALID_STATE', `Trial limit ${name} is inconsistent`)
    }
  }
  assertInteger(trial.buildAttempts, 'Aggregate build attempts', {
    min: 0,
    max: limits.maxBuildAttempts,
  })
  if (!Array.isArray(trial.attemptRecords)) {
    fail('INVALID_STATE', 'Trial attempt records must be an array')
  }
  let recordedAttempts = 0
  for (const record of trial.attemptRecords) {
    const entry = assertRecord(record, 'Trial attempt receipt')
    assertString(entry.environmentId, 'Attempt environment identity')
    assertSha(entry.revision, 'Attempt revision')
    if (
      !['create', 'update', 'pause', 'resume', 'delete'].includes(entry.command)
    ) {
      fail('INVALID_STATE', 'Trial attempt command is invalid')
    }
    recordedAttempts += assertInteger(entry.attempts, 'Attempt count')
  }
  if (recordedAttempts !== trial.buildAttempts) {
    fail('INVALID_STATE', 'Aggregate build-attempt receipts are inconsistent')
  }
  assertRecord(state.environments, 'Environment inventory')
  assertRecord(state.terminalIdentities, 'Terminal identity inventory')
  if (liveEnvironmentCount(state) > limits.maxEnvironments) {
    fail(
      'INVALID_STATE',
      'Environment inventory exceeds the configured allowance'
    )
  }
  for (const [id, terminal] of Object.entries(state.terminalIdentities)) {
    assertRecord(terminal, `Terminal identity ${id}`)
    assertString(terminal.reason, `Terminal identity ${id} reason`)
    assertInteger(terminal.sequence, `Terminal identity ${id} sequence`, {
      min: 1,
    })
  }
  for (const [id, environment] of Object.entries(state.environments)) {
    assertRecord(environment, `Environment ${id}`)
    if (environment.id !== id) {
      fail('INVALID_STATE', `Environment inventory key ${id} is inconsistent`)
    }
    assertSha(environment.revision, `Environment ${id} revision`)
    assertInteger(environment.lastSequence, `Environment ${id} sequence`, {
      min: 1,
    })
    if (
      !['active', 'paused', 'pending', 'terminal'].includes(environment.phase)
    ) {
      fail('INVALID_STATE', `Environment ${id} phase is invalid`)
    }
    if (typeof environment.deleted !== 'boolean') {
      fail('INVALID_STATE', `Environment ${id} deletion state is invalid`)
    }
    if (typeof environment.fixturesSeeded !== 'boolean') {
      fail('INVALID_STATE', `Environment ${id} fixture state is invalid`)
    }
    if (!Array.isArray(environment.inventory)) {
      fail('INVALID_STATE', `Environment ${id} inventory must be an array`)
    }
    optionalStringArray(
      environment.selectedResources,
      `Environment ${id} selected resources`
    )
    assertRecord(
      environment.resourceStates,
      `Environment ${id} resource states`
    )
    const inventoryNames = new Set()
    for (const resource of environment.inventory) {
      assertRecord(resource, `Environment ${id} resource`)
      const binding = assertString(
        resource.binding,
        `Environment ${id} resource binding`
      )
      assertString(resource.kind, `Environment ${id} resource ${binding} kind`)
      if (typeof resource.data !== 'boolean' || inventoryNames.has(binding)) {
        fail(
          'INVALID_STATE',
          `Environment ${id} resource inventory is inconsistent`
        )
      }
      inventoryNames.add(binding)
      if (!Object.hasOwn(environment.resourceStates, resource.binding)) {
        fail(
          'INVALID_STATE',
          `Environment ${id} is missing an owned resource receipt`
        )
      }
    }
    for (const name of environment.selectedResources) {
      if (!inventoryNames.has(name)) {
        fail('INVALID_STATE', `Environment ${id} selects an unowned resource`)
      }
    }
    if (
      Object.keys(environment.resourceStates).length !== inventoryNames.size
    ) {
      fail('INVALID_STATE', `Environment ${id} has an unknown resource receipt`)
    }
    for (const [name, resourceState] of Object.entries(
      environment.resourceStates
    )) {
      if (
        !inventoryNames.has(name) ||
        !['active', 'paused', 'deleted'].includes(resourceState)
      ) {
        fail(
          'INVALID_STATE',
          `Environment ${id} resource receipt is inconsistent`
        )
      }
    }
  }
  return state
}

function normalizeSourceEvent(input) {
  const event = assertRecord(input, 'Lifecycle event')
  if (event.obsolete === true) {
    return { obsolete: true, eventName: event.eventName ?? null }
  }
  const eventName = assertString(event.eventName, 'Event name')
  if (
    !['pull_request', 'push', 'pause', 'resume', 'teardown'].includes(eventName)
  ) {
    fail('INVALID_EVENT', `Unsupported lifecycle event: ${eventName}`)
  }
  const common = {
    eventName,
    repository: assertRepository(event.repository, 'Event repository'),
    revision: assertSha(event.revision, 'Event revision'),
    sequence: assertInteger(event.sequence, 'Event sequence', { min: 1 }),
    obsolete: false,
  }
  if (eventName === 'push') {
    return {
      ...common,
      branch: assertString(event.branch, 'Push branch'),
      pullRequest: null,
      headRepository: null,
    }
  }
  const number = assertInteger(event.number, 'Pull request number', { min: 1 })
  const headRepository = assertRepository(
    event.headRepository,
    'Event head repository'
  )
  const labels = optionalStringArray(event.labels ?? [], 'Pull request labels')
  const pullRequest = {
    number,
    state: event.state ?? null,
    merged: event.merged ?? null,
    isFork: event.isFork ?? null,
    labels: [...labels],
    manualOptIn: event.manualOptIn === true,
  }
  return {
    ...common,
    branch: null,
    headRepository,
    pullRequest,
  }
}

function identityFor(event) {
  return event.pullRequest
    ? `${event.repository}#pull/${event.pullRequest.number}`
    : `${event.repository}#branch/${event.branch}`
}

function sourceDropReason(event) {
  if (event.eventName === 'pull_request') {
    if (event.repository !== event.headRepository) return 'repository-mismatch'
    if (event.pullRequest.isFork !== false) return 'pull-request-fork'
    if (event.pullRequest.merged !== false) return 'pull-request-merged'
    if (event.pullRequest.state !== 'open') return 'pull-request-not-open'
  }
  if (event.eventName === 'push' && event.branch !== 'v3-ai') {
    return 'branch-not-allowlisted'
  }
  return null
}

function normalizeDesiredPlan(input, event) {
  const plan = assertRecord(input, 'Desired preview plan')
  if (plan.status !== 'planning-ready') {
    return { blocked: 'plan-not-ready' }
  }
  if (plan.reuseEligibility?.eligible !== true) {
    return { blocked: 'plan-not-ready' }
  }
  if (plan.recreationRequired === true) {
    return { blocked: 'recreation-required' }
  }
  if (
    plan.effects?.providerCredentialsRead !== false ||
    plan.effects?.runtimeStarted !== false
  ) {
    fail('INVALID_PLAN', 'Planner effects must remain values-free and inactive')
  }
  const revision = assertSha(plan.sha?.candidate, 'Planned candidate revision')
  const provenance = plan.provenance?.candidate
  if (
    !isRecord(provenance) ||
    provenance.status !== 'verified' ||
    provenance.sha !== revision
  ) {
    fail(
      'SOURCE_PROVENANCE_MISMATCH',
      'Planned candidate provenance is not verified'
    )
  }
  if (revision !== event.revision) {
    fail(
      'SOURCE_REVISION_MISMATCH',
      'Current event revision does not match the immutable planner output'
    )
  }
  const source = assertRecord(plan.sourceSelection, 'Planned source selection')
  if (source.eligible !== true) {
    return { blocked: 'source-not-eligible' }
  }
  if (source.eventName !== event.eventName) {
    fail(
      'SOURCE_SELECTION_MISMATCH',
      'Planner source event does not match the lifecycle event'
    )
  }
  if (
    (source.repository ?? null) !== null &&
    source.repository !== event.repository
  ) {
    fail(
      'SOURCE_SELECTION_MISMATCH',
      'Planner repository does not match the event'
    )
  }
  if (event.pullRequest) {
    if (
      source.headRepository !== event.headRepository ||
      source.state !== event.pullRequest.state ||
      source.merged !== event.pullRequest.merged ||
      source.isFork !== event.pullRequest.isFork
    ) {
      fail(
        'SOURCE_SELECTION_MISMATCH',
        'Planner pull request state does not match the event'
      )
    }
    const policy = assertRecord(
      source.pullRequestPolicy,
      'Planner pull request policy'
    )
    const label = assertString(policy.label, 'Preview opt-in label')
    const labelled = event.pullRequest.labels.includes(label)
    const manualAllowed =
      policy.manualOptIn === true && event.pullRequest.manualOptIn
    if (!labelled && !manualAllowed)
      return { blocked: 'preview-opt-in-missing' }
  } else {
    const allowlist = optionalStringArray(
      source.branchAllowlist,
      'Planner branch allowlist'
    )
    if (!allowlist.includes('v3-ai') || !allowlist.includes(event.branch)) {
      return { blocked: 'branch-not-allowlisted' }
    }
    if (source.sourceBranch !== event.branch) {
      fail(
        'SOURCE_SELECTION_MISMATCH',
        'Planner push branch does not match the event'
      )
    }
  }
  const profile = optionalStringArray(
    plan.profile?.canonical,
    'Canonical profiles'
  )
  if (profile.length === 0) return { blocked: 'no-runtime' }
  const bindings = plan.resources?.bindings
  if (!Array.isArray(bindings)) {
    fail('INVALID_PLAN', 'Planner resource bindings must be an array')
  }
  const dataResources = optionalStringArray(
    plan.resources?.dataResources ?? [],
    'Planner data resources'
  )
  const seen = new Set()
  const resources = []
  for (const candidate of bindings) {
    const resource = assertRecord(candidate, 'Planner resource binding')
    const binding = assertString(resource.binding, 'Planner resource name')
    const kind = assertString(resource.kind, `Planner resource ${binding} kind`)
    if (seen.has(binding)) {
      fail('INVALID_PLAN', `Planner resource ${binding} is duplicated`)
    }
    seen.add(binding)
    if (NON_PROVIDER_RESOURCE_KINDS.has(kind)) continue
    resources.push({
      binding,
      kind,
      data: kind === 'data-service' || dataResources.includes(binding),
    })
  }
  const providerNames = new Set(resources.map((resource) => resource.binding))
  for (const name of dataResources) {
    if (!providerNames.has(name)) {
      fail('INVALID_PLAN', `Planner data resource ${name} is not bound`)
    }
  }
  const builds = plan.images?.builds
  if (!Array.isArray(builds)) {
    fail('INVALID_PLAN', 'Planner image builds must be an array')
  }
  if (typeof plan.postgresFixturesRequired !== 'boolean') {
    fail('INVALID_PLAN', 'Planner fixture requirement must be explicit')
  }
  return {
    profile: [...new Set(profile)].sort(),
    revision,
    resources,
    buildAttempts: builds.length,
    fixturesRequired: plan.postgresFixturesRequired,
  }
}

function previewSkipKey(node) {
  const match = /^\$\{args\.skip\.([A-Za-z0-9]+)\}$/.exec(
    node.skipNodeExecution
  )
  if (!match)
    fail('INVALID_PREVIEW_GRAPH', 'Graph skip expressions must be exact')
  return match[1]
}

function collectPreviewNodes(value, nodes = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectPreviewNodes(entry, nodes)
  } else if (isRecord(value)) {
    if (value.skipNodeExecution !== undefined) nodes.push(value)
    for (const entry of Object.values(value)) collectPreviewNodes(entry, nodes)
  }
  return nodes
}

const PREVIEW_NODES = collectPreviewNodes(PREVIEW_GRAPH.spec)
const PREVIEW_INSERT_ONLY_SKIPS = new Set(
  PREVIEW_NODES.filter((node) => node.updateMode === 'create').map(
    previewSkipKey
  )
)
const PREVIEW_SUPPORT_SKIPS = new Set(
  [
    ...new Set(
      PREVIEW_NODES.filter((node) => node.kind === 'SecretGroup').map(
        previewSkipKey
      )
    ),
  ].filter((key) =>
    PREVIEW_NODES.every(
      (node) => node.kind === 'SecretGroup' || previewSkipKey(node) !== key
    )
  )
)

function normalizePreviewPlan(input) {
  const plan = assertRecord(input, 'Desired preview plan')
  const candidateSha = assertSha(plan.sha?.candidate, 'Candidate revision')
  const controllerSha = assertSha(plan.sha?.controller, 'Controller revision')
  if (
    plan.status !== 'planning-ready' ||
    plan.reuseEligibility?.eligible !== true ||
    plan.recreationRequired === true ||
    plan.effects?.providerCredentialsRead !== false ||
    plan.effects?.runtimeStarted !== false ||
    plan.provenance?.candidate?.sha !== candidateSha ||
    plan.provenance.candidate.status !== 'verified' ||
    plan.provenance?.controller?.sha !== controllerSha ||
    plan.provenance.controller.status !== 'verified'
  ) {
    fail('INVALID_PLAN', 'Preview plan is not verified and inactive')
  }
  const sourceSelection = assertRecord(
    plan.sourceSelection,
    'Planned source selection'
  )
  if (
    sourceSelection.eligible !== true ||
    !Array.isArray(plan.resources?.bindings)
  ) {
    fail('INVALID_PLAN', 'Plan source and resources are not eligible')
  }
  const bindings = new Map()
  for (const entry of plan.resources.bindings) {
    const resource = assertRecord(entry, 'Planned resource')
    const name = assertString(resource.binding, 'Resource binding')
    assertString(resource.kind, `Resource ${name} kind`)
    if (bindings.has(name)) fail('INVALID_PLAN', `Duplicate resource ${name}`)
    bindings.set(name, resource)
  }
  return { candidateSha, controllerSha, bindings, sourceSelection }
}

function normalizePreviewSource(input, plan) {
  const source = assertRecord(input, 'Preview source binding')
  const repository = assertRepository(source.repository, 'Source repository')
  const ref = assertString(source.ref, 'Source ref')
  const headSha = assertSha(source.headSha, 'Source head SHA')
  const controllerSha = assertSha(source.controllerSha, 'Source controller SHA')
  if (
    (plan.sourceSelection.repository != null &&
      plan.sourceSelection.repository !== repository) ||
    plan.sourceSelection.sourceBranch !== ref
  ) {
    fail('SOURCE_PROVENANCE_MISMATCH', 'Source does not match the plan')
  }
  if (headSha !== plan.candidateSha || controllerSha !== plan.controllerSha) {
    fail('SOURCE_REVISION_MISMATCH', 'Source revisions do not match the plan')
  }
  if (ref.startsWith('-') || ref.includes('..') || /[\s\p{Cc}]/u.test(ref)) {
    fail('INVALID_INPUT', 'Source ref is unsafe')
  }
  return { repository, ref, headSha, controllerSha }
}

function normalizePreviewRuntime(input) {
  const runtime = assertRecord(input, 'Preview runtime binding')
  const envId = assertString(runtime.envId, 'Preview environment ID')
  const projectId = assertString(runtime.projectId, 'Preview project ID')
  const domain = assertString(runtime.domain, 'Preview domain').toLowerCase()
  const allowedIp = assertString(runtime.allowedIp, 'Preview allowed IP')
  const lifetimeSeconds = assertInteger(
    runtime.lifetimeSeconds,
    'Preview lifetime',
    { min: 1, max: DEFAULT_PREVIEW_LIFECYCLE_LIMITS.maxLifetimeMs / 1000 }
  )
  if (envId.length > 32 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(envId)) {
    fail('INVALID_INPUT', 'Preview environment ID must be 1-32 characters')
  }
  if (
    !domain.includes('.') ||
    PREVIEW_PRODUCTION_DOMAIN_SUFFIXES.some(
      (suffix) => domain === suffix || domain.endsWith(`.${suffix}`)
    )
  ) {
    fail('UNSAFE_PREVIEW_DOMAIN', 'Preview namespace is unsafe')
  }
  return { envId, projectId, domain, allowedIp, lifetimeSeconds }
}

function normalizePreviewAction(input, plan, admitted) {
  const action = assertRecord(input, 'Preview lifecycle action')
  if (
    !['create', 'update', 'pause', 'resume'].includes(action.command) ||
    typeof admitted !== 'boolean'
  ) {
    fail('INVALID_ACTION', 'Preview action is unsupported')
  }
  if (assertSha(action.revision, 'Action revision') !== plan.candidateSha) {
    fail('SOURCE_REVISION_MISMATCH', 'Action does not match the plan')
  }
  if (
    ['migrate', 'seedFixtures'].some(
      (key) => action[key] !== undefined && typeof action[key] !== 'boolean'
    )
  ) {
    fail('INVALID_ACTION', 'Job flags must be boolean')
  }
  return action
}

function selectedPreviewResources(plan, action) {
  if (action.command === 'pause' || action.command === 'resume') {
    return new Set()
  }
  return new Set(plan.bindings.keys())
}

function buildPreviewSkipArguments(plan, action, selected) {
  const skip = Object.fromEntries(PREVIEW_SKIP_KEYS.map((key) => [key, 'true']))
  const mutable = action.command === 'create' || action.command === 'update'
  if (!mutable) return skip
  const selectedKeys = new Set()
  for (const name of selected) {
    const key =
      PREVIEW_SKIP_ALIASES[name] ??
      PREVIEW_SKIP_BY_NORMALIZED_BINDING.get(
        name.replace(/[-_]/g, '').toLowerCase()
      )
    const kind = plan.bindings.get(name)?.kind
    if (!key) {
      if (['app', 'data-service', 'process', 'service'].includes(kind)) {
        fail('UNSUPPORTED_PLAN_BINDING', `No graph node exists for ${name}`)
      }
      continue
    }
    selectedKeys.add(key)
    if (action.command === 'create' || !PREVIEW_INSERT_ONLY_SKIPS.has(key)) {
      skip[key] = 'false'
    }
  }

  const serviceIds = new Set(
    PREVIEW_NODES.filter(
      (node) =>
        node.kind === 'DeploymentService' &&
        selectedKeys.has(previewSkipKey(node))
    ).map((node) => node.spec?.name)
  )
  for (const node of PREVIEW_NODES) {
    const key = previewSkipKey(node)
    const ids = node.spec?.restrictions?.nfObjects
    if (
      PREVIEW_SUPPORT_SKIPS.has(key) &&
      Array.isArray(ids) &&
      ids.some(({ id }) => serviceIds.has(id))
    ) {
      skip[key] = 'false'
    }
  }

  const enableJob = (enabled, planned, ...keys) => {
    if (!enabled) return
    if (!planned.some((name) => plan.bindings.has(name))) {
      fail('RESOURCE_SELECTION_MISMATCH', 'Job image is not planned')
    }
    for (const key of keys) skip[key] = 'false'
  }
  if (mutable) {
    enableJob(
      action.migrate === true,
      ['migrator'],
      'schemaMigration',
      'runMigration'
    )
  }
  if (action.seedFixtures === true) {
    if (action.command !== 'create') {
      fail('INVALID_ACTION', 'Fixtures are create-only')
    }
    enableJob(
      true,
      ['postgres-fixtures', 'fixtures'],
      'fixtures',
      'runFixtures'
    )
  }
  return skip
}

function enabledPreviewArgumentPaths(skip) {
  const paths = new Set()
  function walk(value) {
    if (typeof value === 'string') {
      for (const match of value.matchAll(PREVIEW_ARGUMENT_REFERENCE)) {
        paths.add(match[1])
      }
    } else if (Array.isArray(value)) {
      for (const entry of value) walk(entry)
    } else if (isRecord(value)) {
      if (value.skipNodeExecution !== undefined) {
        const key = previewSkipKey(value)
        if (skip[key] !== 'true' && skip[key] !== 'false') {
          fail('INVALID_PREVIEW_ARGUMENT', `skip.${key} must be true or false`)
        }
        if (skip[key] === 'true') return
      }
      for (const [key, entry] of Object.entries(value)) {
        if (key !== 'skipNodeExecution') walk(entry)
      }
    }
  }
  walk(PREVIEW_GRAPH.spec)
  return paths
}

function validatePreviewArguments(args, source, runtime) {
  const placeholders = new Set([
    'change-me',
    'changeme',
    'default',
    'null',
    'password',
    'secret',
    'undefined',
  ])
  for (const path of enabledPreviewArgumentPaths(args.skip)) {
    let value = args
    for (const segment of path.split('.')) {
      if (!isRecord(value) || !Object.hasOwn(value, segment)) {
        fail('MISSING_PREVIEW_ARGUMENT', `${path} is required`)
      }
      value = value[segment]
    }
    if (value === undefined || value === null || value === '') {
      fail('MISSING_PREVIEW_ARGUMENT', `${path} is required`)
    }
    if (path.startsWith('secrets.')) {
      const normalized =
        typeof value === 'string' ? value.trim().toLowerCase() : ''
      if (
        !normalized ||
        placeholders.has(normalized) ||
        normalized.includes('${') ||
        /^<[^>]+>$/.test(normalized)
      ) {
        fail('UNSAFE_PREVIEW_SECRET', `${path} is not a trusted value`)
      }
    }
    if (/^images\.[^.]+\.branch$/.test(path) && value !== source.ref) {
      fail('SOURCE_PROVENANCE_MISMATCH', `${path} does not match source ref`)
    }
    if (path.startsWith('runtimeEnvironment.')) {
      const key = path.slice('runtimeEnvironment.'.length)
      let valid = typeof value === 'string'
      if (valid && key === 'COOKIE_DOMAIN') {
        valid = value === runtime.domain || value === `.${runtime.domain}`
      } else if (valid) {
        const app = PREVIEW_ORIGIN_APPS[key]
        try {
          const origin = new URL(value)
          valid =
            app !== undefined &&
            origin.protocol === 'https:' &&
            origin.username === '' &&
            origin.password === '' &&
            !value.includes('?') &&
            !value.includes('#') &&
            origin.pathname === '/' &&
            origin.hostname === `${runtime.envId}--${app}.${runtime.domain}`
        } catch {
          valid = false
        }
      }
      if (!valid) {
        fail(
          'UNSAFE_PREVIEW_ORIGIN',
          `${path} is outside the preview namespace`
        )
      }
    }
  }
}

/**
 * Assembles graph arguments only. Addon bootstrap, job orchestration, mounted
 * configuration and runtime qualification remain caller-owned stages.
 */
export function assemblePreviewArguments({
  plan: planInput,
  action: actionInput,
  admitted = false,
  runtime: runtimeInput,
  source: sourceInput,
  config: configInput,
  images: imagesInput,
  credentials: credentialsInput,
} = {}) {
  const plan = normalizePreviewPlan(planInput)
  const action = normalizePreviewAction(actionInput, plan, admitted)
  const runtime = normalizePreviewRuntime(runtimeInput)
  const source = normalizePreviewSource(sourceInput, plan)
  const skip = buildPreviewSkipArguments(
    plan,
    action,
    selectedPreviewResources(plan, action)
  )
  const active = action.command === 'create' || action.command === 'update'
  const config = active
    ? assertRecord(configInput ?? {}, 'Preview configuration')
    : {}
  const credentials = active
    ? assertRecord(credentialsInput ?? {}, 'Preview credentials')
    : {}
  const args = {
    ...config,
    startInstances: admitted && active ? 1 : 0,
    projectId: runtime.projectId,
    envId: runtime.envId,
    domain: runtime.domain,
    allowedIp: runtime.allowedIp,
    lifetimeSeconds: runtime.lifetimeSeconds,
    source,
    skip,
    images: active ? (imagesInput ?? {}) : {},
    secrets: active ? credentials.secrets : {},
    bindings: active ? credentials.bindings : {},
  }
  validatePreviewArguments(args, source, runtime)
  return args
}

const NORTHFLANK_OWNED_TYPES = new Set(['service', 'addon'])
const NORTHFLANK_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

function northflankPathSegment(value, label) {
  const segment = assertString(value, label)
  if (!NORTHFLANK_PATH_SEGMENT.test(segment)) {
    fail('UNSAFE_OWNERSHIP_PATH', `${label} must be a single safe path segment`)
  }
  return segment
}

function normalizeNorthflankOwnership(input) {
  const ownership = assertRecord(input, 'Northflank ownership receipt')
  if (ownership.schemaVersion !== 1) {
    fail('INVALID_OWNERSHIP', 'Ownership receipt requires schemaVersion 1')
  }
  const projectId = northflankPathSegment(
    ownership.projectId,
    'Northflank ownership project ID'
  )
  const environmentId = assertString(
    ownership.environmentId,
    'Northflank ownership environment ID'
  )
  const lifecycleEnvironmentId = assertString(
    ownership.lifecycleEnvironmentId,
    'Northflank ownership lifecycle environment ID'
  )
  if (!Array.isArray(ownership.resources) || ownership.resources.length === 0) {
    fail('INVALID_OWNERSHIP', 'Ownership receipt must list exact resources')
  }
  const bindings = new Set()
  const identities = new Set()
  const resources = ownership.resources.map((input) => {
    const entry = assertRecord(input, 'Northflank owned resource')
    const binding = assertString(entry.binding, 'Northflank owned binding')
    const nativeType = assertString(
      entry.nativeType,
      `Northflank owned ${binding} type`
    )
    const id = northflankPathSegment(entry.id, `Northflank owned ${binding} ID`)
    const endpoint = assertString(
      entry.endpoint,
      `Northflank owned ${binding} endpoint`
    )
    if (!NORTHFLANK_OWNED_TYPES.has(nativeType)) {
      fail('INVALID_OWNERSHIP', `Owned ${binding} type is unsupported`)
    }
    if (entry.uid === undefined && entry.createdAt === undefined) {
      fail('INVALID_OWNERSHIP', `Owned ${binding} has no immutable identity`)
    }
    const uid =
      entry.uid === undefined
        ? undefined
        : assertString(entry.uid, `Northflank owned ${binding} UID`)
    const createdAt =
      entry.createdAt === undefined
        ? undefined
        : assertString(
            entry.createdAt,
            `Northflank owned ${binding} creation time`
          )
    const segment = nativeType === 'service' ? 'services' : 'addons'
    const expectedEndpoint = `/v1/projects/${projectId}/${segment}/${id}`
    if (endpoint !== expectedEndpoint) {
      fail('OWNERSHIP_MISMATCH', `Owned ${binding} endpoint is inconsistent`)
    }
    const identity = `${nativeType}:${id}`
    if (bindings.has(binding) || identities.has(identity)) {
      fail('INVALID_OWNERSHIP', 'Northflank ownership contains duplicates')
    }
    bindings.add(binding)
    identities.add(identity)
    return Object.freeze({ binding, nativeType, id, endpoint, uid, createdAt })
  })
  return Object.freeze({
    projectId,
    environmentId,
    lifecycleEnvironmentId,
    resources: Object.freeze(resources),
  })
}

function normalizeNorthflankAction(action, ownership) {
  const input = assertRecord(action, 'Northflank lifecycle action')
  if (input.command === 'create' || input.command === 'update') {
    fail(
      'STAGED_PROVISIONER_REQUIRED',
      'Create and update require the staged provisioner'
    )
  }
  if (!['pause', 'resume', 'delete'].includes(input.command)) {
    fail('INVALID_ACTION', 'Northflank lifecycle action is unsupported')
  }
  if (input.environmentId !== ownership.lifecycleEnvironmentId) {
    fail('OWNERSHIP_MISMATCH', 'Lifecycle environment is not owned')
  }
  if (input.retryPolicy !== 'none' || input.providerDefaults !== false) {
    fail(
      'PROVIDER_DEFAULTS_DISALLOWED',
      'Provider defaults and retries must be disabled'
    )
  }
  if (!Array.isArray(input.resources))
    fail('INVALID_ACTION', 'Northflank lifecycle inventory is missing')
  const owned = new Map(ownership.resources.map((r) => [r.binding, r]))
  const seen = new Set()
  const actions = new Map()
  for (const candidate of input.resources) {
    const resource = assertRecord(candidate, 'Northflank lifecycle resource')
    const binding = assertString(
      resource.binding,
      'Northflank lifecycle binding'
    )
    assertString(resource.kind, 'Northflank lifecycle kind')
    const entry = owned.get(binding)
    const expectedType = resource.data === true ? 'addon' : 'service'
    if (
      !entry ||
      seen.has(binding) ||
      typeof resource.data !== 'boolean' ||
      entry.nativeType !== expectedType
    ) {
      fail('OWNERSHIP_MISMATCH', `Lifecycle resource ${binding} is not owned`)
    }
    seen.add(binding)
    actions.set(binding, resource)
  }
  if (seen.size !== owned.size)
    fail('OWNERSHIP_MISMATCH', 'Northflank ownership inventory is incomplete')
  const resources = ownership.resources.map((entry) => ({
    ...entry,
    action: actions.get(entry.binding),
  }))
  return { ...input, resources }
}

async function readNorthflankResource(resource, ownership, request) {
  const response = assertRecord(
    await request({ method: 'GET', endpoint: resource.endpoint }),
    'Northflank read response'
  )
  if (response.status === 404) return null
  if (response.status !== 200) {
    fail(
      'PROVIDER_READ_FAILED',
      `Northflank read failed for ${resource.binding}`
    )
  }
  const data = assertRecord(
    assertRecord(response.body, 'Northflank read body').data,
    `Northflank observed ${resource.binding}`
  )
  if (
    data.id !== resource.id ||
    (data.stageId !== undefined && data.stageId !== ownership.environmentId) ||
    (resource.uid !== undefined && data.uid !== resource.uid) ||
    (resource.createdAt !== undefined &&
      data.createdAt !== resource.createdAt) ||
    (data.projectId !== undefined && data.projectId !== ownership.projectId)
  ) {
    fail('OWNERSHIP_MISMATCH', `Observed ${resource.binding} is inconsistent`)
  }
  return data
}

function northflankWriteAccepted(response, allowNotFound = false) {
  const status = assertRecord(response, 'Northflank write response').status
  return (
    (allowNotFound && status === 404) ||
    (Number.isInteger(status) && status >= 200 && status < 300)
  )
}

function orderedNorthflankWrites(resources, command) {
  if (command === 'delete') return resources
  const apps = resources.filter((resource) => resource.action.kind === 'app')
  const dependencies = resources.filter(
    (resource) => resource.action.kind !== 'app'
  )
  return command === 'resume'
    ? [...dependencies, ...apps]
    : [...apps, ...dependencies]
}

/**
 * Builds the native driver for an already-provisioned preview. The controller
 * owns the immutable receipt. Each exact GET or write is requested once; only
 * a bounded `{ settled: true }` proof yields the lifecycle receipt. Receipt
 * resources must list non-app dependencies before apps for resume; their order
 * is preserved within each group, and pause writes apps before dependencies.
 */
export function createNorthflankPreviewLifecycleDriver({
  ownership: ownershipInput,
  request,
  settle,
} = {}) {
  if (typeof request !== 'function' || typeof settle !== 'function') {
    fail('INVALID_DRIVER', 'Northflank driver requires request and settle')
  }
  const ownership = normalizeNorthflankOwnership(ownershipInput)
  return {
    async applyLifecycle(actionInput) {
      const action = normalizeNorthflankAction(actionInput, ownership)
      const resources = []
      for (const resource of action.resources) {
        resources.push({
          ...resource,
          present:
            (await readNorthflankResource(resource, ownership, request)) !==
            null,
        })
      }
      const missing = resources.find((resource) => !resource.present)
      if (action.command !== 'delete' && missing) {
        fail('OWNED_RESOURCE_MISSING', `Owned ${missing.binding} is missing`)
      }
      for (const resource of orderedNorthflankWrites(
        resources,
        action.command
      )) {
        if (action.command === 'delete' && !resource.present) continue
        const response = await request({
          method: action.command === 'delete' ? 'DELETE' : 'POST',
          endpoint:
            action.command === 'delete'
              ? resource.endpoint
              : `${resource.endpoint}/${action.command}`,
          ...(action.command === 'resume' && resource.nativeType === 'service'
            ? { body: {} }
            : {}),
        })
        if (!northflankWriteAccepted(response, action.command === 'delete')) {
          fail(
            'PROVIDER_WRITE_FAILED',
            `${action.command} was not accepted for ${resource.binding}`
          )
        }
      }
      const settlement = await settle({
        command: action.command,
        projectId: ownership.projectId,
        environmentId: ownership.environmentId,
        resources: resources.map((resource) => ({
          binding: resource.binding,
          nativeType: resource.nativeType,
          endpoint: resource.endpoint,
          id: resource.id,
          expectedState:
            action.command === 'delete' ? 'absent' : resource.action.state,
        })),
      })
      if (settlement?.settled !== true) {
        fail('UNSETTLED_PROVIDER', `${action.command} did not settle`)
      }
      const receipt = {
        settled: true,
        environmentId: action.environmentId,
        resources: action.resources.map(({ action: resource }) => ({
          binding: resource.binding,
          state: resource.state,
        })),
        buildAttempts: action.buildAttemptsReserved,
        fixturesSeeded: action.fixturesSeeded,
        retryPolicy: 'none',
      }
      assertReceipt(receipt, actionInput)
      return receipt
    },
  }
}

function liveEnvironmentCount(state) {
  return Object.values(state.environments).filter(
    (environment) => !environment.deleted
  ).length
}

function effectiveResourceStates(command, inventory, selected, previous) {
  const selectedNames = new Set(selected.map((resource) => resource.binding))
  const states = {}
  for (const resource of inventory) {
    if (command === 'delete') {
      states[resource.binding] = 'deleted'
    } else if (command === 'pause') {
      states[resource.binding] = resource.data ? 'active' : 'paused'
    } else if (resource.data) {
      states[resource.binding] = 'active'
    } else {
      states[resource.binding] = selectedNames.has(resource.binding)
        ? 'active'
        : 'paused'
    }
  }
  return states
}

function mergeInventory(previous, selected) {
  const merged = new Map(
    previous.map((resource) => [resource.binding, resource])
  )
  for (const resource of selected) merged.set(resource.binding, resource)
  return [...merged.values()].sort((left, right) =>
    left.binding.localeCompare(right.binding)
  )
}

function makeEnvironment({
  id,
  event,
  plan,
  previous,
  phase,
  inventory,
  resourceStates,
  fixturesSeeded,
  terminalReason,
  deleted,
}) {
  return {
    id,
    repository: event.repository,
    pullRequest: event.pullRequest?.number ?? null,
    branch: event.branch ?? null,
    revision: plan?.revision ?? previous.revision,
    profile: plan?.profile ?? previous.profile,
    selectedResources: plan
      ? plan.resources.map((resource) => resource.binding)
      : previous.selectedResources,
    inventory: clone(inventory),
    resourceStates: { ...resourceStates },
    lastSequence: event.sequence,
    phase,
    fixturesSeeded,
    terminalReason: terminalReason ?? null,
    deleted,
  }
}

function executionResult({ state, reason, action, nextState }) {
  return { decision: 'execute', reason, action, nextState }
}

function dropResult({ state, reason, nextState = state }) {
  return { decision: 'drop', reason, action: null, nextState }
}

function terminalDrop(state, event, id, reason, terminalReason) {
  const nextState = clone(state)
  nextState.terminalIdentities[id] = {
    reason: terminalReason,
    sequence: event.sequence,
  }
  return dropResult({ state, reason, nextState })
}

function reserveProviderOperation(planned) {
  const admissionState = clone(planned.nextState)
  const action = planned.action
  admissionState.environments[action.environmentId].phase = 'pending'
  admissionState.trial.buildAttempts += action.buildAttemptsReserved
  admissionState.trial.attemptRecords.push({
    environmentId: action.environmentId,
    revision: action.revision ?? action.previousRevision,
    command: action.command,
    attempts: action.buildAttemptsReserved,
  })
  return { ...planned, admissionState }
}

function planDelete({ state, event, id, environment, reason, terminalReason }) {
  const selected = []
  const resourceStates = effectiveResourceStates(
    'delete',
    environment.inventory,
    selected,
    environment
  )
  const nextEnvironment = makeEnvironment({
    id,
    event,
    previous: environment,
    phase: 'terminal',
    inventory: environment.inventory,
    resourceStates,
    fixturesSeeded: false,
    terminalReason,
    deleted: true,
  })
  const admissionState = clone(state)
  admissionState.environments[id] = {
    ...nextEnvironment,
    resourceStates: { ...environment.resourceStates },
    fixturesSeeded: environment.fixturesSeeded,
    deleted: false,
  }
  admissionState.terminalIdentities[id] = {
    reason: terminalReason,
    sequence: event.sequence,
  }
  const nextState = clone(admissionState)
  nextState.environments[id] = nextEnvironment
  const action = {
    schemaVersion: 1,
    command: 'delete',
    environmentId: id,
    repository: event.repository,
    pullRequest: environment.pullRequest,
    branch: environment.branch,
    previousRevision: environment.revision,
    revision: null,
    profile: [],
    resources: environment.inventory.map((resource) => ({
      ...resource,
      state: 'deleted',
    })),
    pauseResources: [],
    resumeResources: [],
    migrate: false,
    seedFixtures: false,
    fixturesSeeded: false,
    buildAttemptsReserved: 0,
    retryPolicy: 'none',
    providerDefaults: false,
  }
  return {
    ...executionResult({ state, reason, action, nextState }),
    admissionState,
  }
}

function planCreate({ state, event, id, plan }) {
  const inventory = plan.resources
  const resourceStates = effectiveResourceStates(
    'create',
    inventory,
    inventory,
    null
  )
  const seedFixtures = plan.fixturesRequired
  const nextState = clone(state)
  const environment = makeEnvironment({
    id,
    event,
    plan,
    previous: null,
    phase: 'active',
    inventory,
    resourceStates,
    fixturesSeeded: seedFixtures,
    terminalReason: null,
    deleted: false,
  })
  nextState.environments[id] = environment
  return executionResult({
    state,
    reason: 'preview-admitted',
    nextState,
    action: {
      schemaVersion: 1,
      command: 'create',
      environmentId: id,
      repository: event.repository,
      pullRequest: environment.pullRequest,
      branch: environment.branch,
      previousRevision: null,
      revision: plan.revision,
      profile: plan.profile,
      resources: inventory.map((resource) => ({
        ...resource,
        state: 'active',
      })),
      pauseResources: [],
      resumeResources: inventory
        .filter((resource) => !resource.data)
        .map((resource) => resource.binding),
      migrate: true,
      seedFixtures,
      fixturesSeeded: seedFixtures,
      buildAttemptsReserved: plan.buildAttempts,
      retryPolicy: 'none',
      providerDefaults: false,
    },
  })
}

function planUpdate({ state, event, id, plan, previous }) {
  const inventory = mergeInventory(previous.inventory, plan.resources)
  const selectedNames = new Set(
    plan.resources.map((resource) => resource.binding)
  )
  const resourceStates = effectiveResourceStates(
    'update',
    inventory,
    plan.resources,
    previous
  )
  const pauseResources = inventory
    .filter(
      (resource) =>
        !resource.data &&
        previous.resourceStates[resource.binding] === 'active' &&
        !selectedNames.has(resource.binding)
    )
    .map((resource) => resource.binding)
  const resumeResources = inventory
    .filter(
      (resource) =>
        selectedNames.has(resource.binding) &&
        !resource.data &&
        previous.resourceStates[resource.binding] !== 'active'
    )
    .map((resource) => resource.binding)
  const seedFixtures =
    previous.fixturesSeeded !== true && plan.fixturesRequired === true
  const nextState = clone(state)
  const environment = makeEnvironment({
    id,
    event,
    plan,
    previous,
    phase: 'active',
    inventory,
    resourceStates,
    fixturesSeeded: previous.fixturesSeeded || seedFixtures,
    terminalReason: null,
    deleted: false,
  })
  nextState.environments[id] = environment
  return executionResult({
    state,
    reason:
      pauseResources.length > 0 ? 'profile-contracted' : 'preview-updated',
    nextState,
    action: {
      schemaVersion: 1,
      command: 'update',
      environmentId: id,
      repository: event.repository,
      pullRequest: environment.pullRequest,
      branch: environment.branch,
      previousRevision: previous.revision,
      revision: plan.revision,
      profile: plan.profile,
      resources: inventory.map((resource) => ({
        ...resource,
        state: resourceStates[resource.binding],
      })),
      pauseResources,
      resumeResources,
      migrate: true,
      seedFixtures,
      fixturesSeeded: environment.fixturesSeeded,
      buildAttemptsReserved: plan.buildAttempts,
      retryPolicy: 'none',
      providerDefaults: false,
    },
  })
}

function planPauseResume({ state, event, id, environment, command }) {
  const selected =
    command === 'resume'
      ? environment.selectedResources.map((name) =>
          environment.inventory.find((resource) => resource.binding === name)
        )
      : []
  const resourceStates = effectiveResourceStates(
    command,
    environment.inventory,
    selected,
    environment
  )
  const nextState = clone(state)
  nextState.environments[id] = makeEnvironment({
    id,
    event,
    previous: environment,
    phase: command === 'resume' ? 'active' : 'paused',
    inventory: environment.inventory,
    resourceStates,
    fixturesSeeded: environment.fixturesSeeded,
    terminalReason: null,
    deleted: false,
  })
  return executionResult({
    state,
    reason: command === 'resume' ? 'environment-resumed' : 'environment-paused',
    nextState,
    action: {
      schemaVersion: 1,
      command,
      environmentId: id,
      repository: environment.repository,
      pullRequest: environment.pullRequest,
      branch: environment.branch,
      previousRevision: environment.revision,
      revision: environment.revision,
      profile: environment.profile,
      resources: environment.inventory.map((resource) => ({
        ...resource,
        state: resourceStates[resource.binding],
      })),
      pauseResources:
        command === 'pause'
          ? environment.inventory
              .filter((resource) => !resource.data)
              .map((resource) => resource.binding)
          : [],
      resumeResources:
        command === 'resume'
          ? environment.inventory
              .filter(
                (resource) =>
                  !resource.data &&
                  environment.selectedResources.includes(resource.binding)
              )
              .map((resource) => resource.binding)
          : [],
      migrate: false,
      seedFixtures: false,
      fixturesSeeded: environment.fixturesSeeded,
      buildAttemptsReserved: 0,
      retryPolicy: 'none',
      providerDefaults: false,
    },
  })
}

export function planPreviewReconciliation({
  state,
  desired,
  event,
  now = Date.now(),
}) {
  const inputState = clone(validateState(state))
  const currentTime = assertTime(now, 'Reconciliation time')
  const normalizedEvent = normalizeSourceEvent(event)
  if (normalizedEvent.obsolete) {
    return dropResult({ state: inputState, reason: 'obsolete-event' })
  }
  const id = identityFor(normalizedEvent)
  if (
    normalizedEvent.pullRequest &&
    normalizedEvent.repository !== normalizedEvent.headRepository
  ) {
    return dropResult({ state: inputState, reason: 'repository-mismatch' })
  }
  if (
    normalizedEvent.pullRequest?.isFork !== undefined &&
    normalizedEvent.pullRequest?.isFork !== false
  ) {
    return dropResult({ state: inputState, reason: 'pull-request-fork' })
  }
  const existing = inputState.environments[id]
  const retryingTeardown =
    normalizedEvent.eventName === 'teardown' &&
    existing &&
    !existing.deleted &&
    existing.phase === 'terminal'
  if (
    (inputState.terminalIdentities[id] && !retryingTeardown) ||
    existing?.deleted
  ) {
    return dropResult({ state: inputState, reason: 'terminal-identity' })
  }
  if (existing && normalizedEvent.sequence <= existing.lastSequence) {
    return dropResult({ state: inputState, reason: 'stale-sequence' })
  }
  if (currentTime >= inputState.trial.deadline) {
    if (existing) {
      return planDelete({
        state: inputState,
        event: normalizedEvent,
        id,
        environment: existing,
        reason: 'deadline-exceeded',
        terminalReason: 'deadline',
      })
    }
    const nextState = clone(inputState)
    nextState.terminalIdentities[id] = {
      reason: 'deadline',
      sequence: normalizedEvent.sequence,
    }
    return dropResult({
      state: inputState,
      reason: 'deadline-exceeded',
      nextState,
    })
  }

  if (normalizedEvent.eventName === 'pull_request') {
    const { state: prState, merged } = normalizedEvent.pullRequest
    if (merged === true || prState === 'merged') {
      return existing
        ? planDelete({
            state: inputState,
            event: normalizedEvent,
            id,
            environment: existing,
            reason: 'pull-request-merged',
            terminalReason: 'merged',
          })
        : terminalDrop(
            inputState,
            normalizedEvent,
            id,
            'pull-request-merged',
            'merged'
          )
    }
    if (prState === 'closed') {
      return existing
        ? planDelete({
            state: inputState,
            event: normalizedEvent,
            id,
            environment: existing,
            reason: 'pull-request-closed',
            terminalReason: 'closed',
          })
        : terminalDrop(
            inputState,
            normalizedEvent,
            id,
            'pull-request-closed',
            'closed'
          )
    }
  }
  if (normalizedEvent.eventName === 'teardown') {
    return existing
      ? planDelete({
          state: inputState,
          event: normalizedEvent,
          id,
          environment: existing,
          reason: 'explicit-teardown',
          terminalReason: 'teardown',
        })
      : terminalDrop(
          inputState,
          normalizedEvent,
          id,
          'explicit-teardown',
          'teardown'
        )
  }
  if (existing?.phase === 'pending') {
    return dropResult({
      state: inputState,
      reason: 'unsettled-provider-operation',
    })
  }
  if (
    normalizedEvent.eventName === 'pause' ||
    normalizedEvent.eventName === 'resume'
  ) {
    if (!existing)
      return dropResult({ state: inputState, reason: 'environment-missing' })
    if (normalizedEvent.revision !== existing.revision) {
      return dropResult({ state: inputState, reason: 'revision-mismatch' })
    }
    const phase = normalizedEvent.eventName === 'pause' ? 'paused' : 'active'
    if (existing.phase === phase) {
      const nextState = clone(inputState)
      nextState.environments[id].lastSequence = normalizedEvent.sequence
      return dropResult({
        state: inputState,
        reason: phase === 'paused' ? 'already-paused' : 'already-active',
        nextState,
      })
    }
    return planPauseResume({
      state: inputState,
      event: normalizedEvent,
      id,
      environment: existing,
      command: normalizedEvent.eventName,
    })
  }

  const sourceReason = sourceDropReason(normalizedEvent)
  if (sourceReason)
    return dropResult({ state: inputState, reason: sourceReason })
  const plan = normalizeDesiredPlan(desired, normalizedEvent)
  if (plan.blocked)
    return dropResult({ state: inputState, reason: plan.blocked })
  if (
    existing &&
    existing.revision === plan.revision &&
    sameSet(existing.profile, plan.profile) &&
    sameSet(
      existing.selectedResources,
      plan.resources.map((resource) => resource.binding)
    )
  ) {
    const nextState = clone(inputState)
    nextState.environments[id].lastSequence = normalizedEvent.sequence
    return dropResult({
      state: inputState,
      reason: 'duplicate-update',
      nextState,
    })
  }
  if (
    !existing &&
    liveEnvironmentCount(inputState) >= inputState.trial.limits.maxEnvironments
  ) {
    return dropResult({ state: inputState, reason: 'environment-limit' })
  }
  const attemptsAfter = inputState.trial.buildAttempts + plan.buildAttempts
  if (attemptsAfter > inputState.trial.limits.maxBuildAttempts) {
    return dropResult({ state: inputState, reason: 'build-attempt-limit' })
  }
  if (!existing)
    return planCreate({ state: inputState, event: normalizedEvent, id, plan })
  return planUpdate({
    state: inputState,
    event: normalizedEvent,
    id,
    plan,
    previous: existing,
  })
}

function assertReceipt(receipt, action) {
  const value = assertRecord(receipt, 'Provider receipt')
  if (value.settled !== true || value.environmentId !== action.environmentId) {
    fail(
      'INCOMPLETE_RECEIPT',
      'Provider receipt is not settled for the owned environment'
    )
  }
  if (value.retryPolicy !== 'none') {
    fail(
      'PROVIDER_DEFAULTS_DISALLOWED',
      'Provider receipt does not prove retries are disabled'
    )
  }
  if (!Array.isArray(value.resources)) {
    fail(
      'INCOMPLETE_RECEIPT',
      'Provider receipt must include every owned resource'
    )
  }
  const expected = new Map(
    action.resources.map((resource) => [resource.binding, resource.state])
  )
  const seen = new Set()
  for (const resource of value.resources) {
    const entry = assertRecord(resource, 'Provider resource receipt')
    const binding = assertString(entry.binding, 'Provider resource name')
    if (!expected.has(binding) || seen.has(binding)) {
      fail('UNKNOWN_RESOURCE', `Provider returned unknown resource ${binding}`)
    }
    seen.add(binding)
    if (entry.state !== expected.get(binding)) {
      fail(
        'INCONSISTENT_RECEIPT',
        `Provider state for ${binding} is inconsistent`
      )
    }
  }
  if (seen.size !== expected.size) {
    fail(
      'INCONSISTENT_RECEIPT',
      'Provider receipt resource inventory is incomplete'
    )
  }
  if (
    !Number.isSafeInteger(value.buildAttempts) ||
    value.buildAttempts < 0 ||
    value.buildAttempts > action.buildAttemptsReserved
  ) {
    fail('INCONSISTENT_RECEIPT', 'Provider build-attempt accounting is invalid')
  }
  if (value.fixturesSeeded !== action.fixturesSeeded) {
    fail(
      'INCONSISTENT_RECEIPT',
      'Provider fixture state does not match the lifecycle'
    )
  }
  return value
}

function commitReceipt(planned, receipt, limits) {
  const nextState = clone(planned.nextState)
  const attempts = nextState.trial.buildAttempts + receipt.buildAttempts
  if (attempts > limits.maxBuildAttempts) {
    fail(
      'BUILD_ATTEMPT_LIMIT',
      'Aggregate build-attempt allowance was exceeded'
    )
  }
  nextState.trial.buildAttempts = attempts
  nextState.trial.attemptRecords.push({
    environmentId: planned.action.environmentId,
    revision: planned.action.revision ?? planned.action.previousRevision,
    command: planned.action.command,
    attempts: receipt.buildAttempts,
  })
  return nextState
}

function publicResult(planned) {
  return {
    decision: planned.decision,
    reason: planned.reason,
    action: planned.action,
  }
}

export async function reconcilePreviewLifecycle({
  state,
  desired,
  event,
  driver,
  now = Date.now(),
}) {
  let planned = planPreviewReconciliation({ state, desired, event, now })
  if (!planned.action)
    return { ...publicResult(planned), state: clone(planned.nextState) }
  if (!driver || typeof driver.applyLifecycle !== 'function') {
    fail(
      'INVALID_DRIVER',
      'A provider driver with applyLifecycle(action) is required'
    )
  }
  if (['create', 'update'].includes(planned.action.command)) {
    planned = reserveProviderOperation(planned)
  }
  let receiptValue
  try {
    receiptValue = await driver.applyLifecycle(clone(planned.action))
  } catch (error) {
    if (planned.admissionState) error.state = clone(planned.admissionState)
    throw error
  }
  let receipt
  try {
    receipt = assertReceipt(receiptValue, planned.action)
  } catch (error) {
    if (planned.admissionState) error.state = clone(planned.admissionState)
    throw error
  }
  const limits = normalizeLimits(planned.nextState.trial.limits)
  const nextState = commitReceipt(planned, receipt, limits)
  return {
    ...publicResult(planned),
    receipt: {
      environmentId: receipt.environmentId,
      buildAttempts: receipt.buildAttempts,
      fixturesSeeded: receipt.fixturesSeeded,
    },
    state: clone(nextState),
  }
}

/**
 * The provider seam is one explicitly configured call. The driver must not add
 * retries or default resources; every receipt is checked against the action's
 * exact owned inventory, final states, retry policy and build allowance.
 * It returns `{settled: true, environmentId, resources: [{binding, state}],
 * buildAttempts, fixturesSeeded, retryPolicy: 'none'}` after native work has
 * settled. A missing or partial receipt retains the build reservation and blocks
 * further paid work until the provider operation is reconciled.
 */
export function createSerializedPreviewLifecycle({
  state,
  driver,
  now = Date.now,
}) {
  let currentState = clone(validateState(state))
  if (!driver || typeof driver.applyLifecycle !== 'function') {
    fail(
      'INVALID_DRIVER',
      'A provider driver with applyLifecycle(action) is required'
    )
  }
  let tail = Promise.resolve()

  return {
    reconcile(request) {
      const result = tail.then(async () => {
        try {
          const reconciled = await reconcilePreviewLifecycle({
            state: currentState,
            desired: request?.desired,
            event: request?.event,
            driver,
            now: now(),
          })
          currentState = reconciled.state
          return reconciled
        } catch (error) {
          if (error.state) currentState = clone(error.state)
          throw error
        }
      })
      tail = result.catch(() => undefined)
      return result
    },
    snapshot() {
      return clone(currentState)
    },
  }
}

function parseJsonArgument(value, label, readFile) {
  const raw = assertString(value, label)
  try {
    if (/^[\s[{]/.test(raw)) return JSON.parse(raw)
    return JSON.parse(readFile(raw, 'utf8'))
  } catch (error) {
    if (error instanceof PreviewLifecycleError) throw error
    fail('INVALID_INPUT', `${label} is not valid JSON`, {
      cause: error.message,
    })
  }
}

const CLI_HELP = `Usage:
  node util/northflank-preview-lifecycle.mjs plan \\
    --state <json-or-path> --desired <json-or-path> --event <json-or-path> \\
    [--now <epoch-ms>]

The plan command is side-effect free. Provider wiring is intentionally absent;
it prints only the admission decision and exact resources that a bound driver
would be allowed to receive.
`

export function runCli(
  argv = process.argv.slice(2),
  {
    readFile = readFileSync,
    write = (value) => process.stdout.write(value),
  } = {}
) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    write(CLI_HELP)
    return { help: true }
  }
  if (argv[0] !== 'plan') {
    fail(
      'INVALID_COMMAND',
      'Only the side-effect-free plan command is supported'
    )
  }
  const options = {}
  for (let index = 1; index < argv.length; index += 2) {
    const name = argv[index]
    const value = argv[index + 1]
    if (
      !['--state', '--desired', '--event', '--now'].includes(name) ||
      value === undefined
    ) {
      fail('INVALID_COMMAND', `Invalid plan option: ${String(name)}`)
    }
    options[name] = value
  }
  for (const required of ['--state', '--desired', '--event']) {
    if (!options[required]) {
      fail('INVALID_COMMAND', `Missing required option ${required}`)
    }
  }
  const now =
    options['--now'] === undefined ? Date.now() : Number(options['--now'])
  const planned = planPreviewReconciliation({
    state: parseJsonArgument(options['--state'], 'State', readFile),
    desired: parseJsonArgument(options['--desired'], 'Desired plan', readFile),
    event: parseJsonArgument(options['--event'], 'Event', readFile),
    now,
  })
  const output = {
    ...publicResult(planned),
    totals: {
      buildAttempts: planned.nextState.trial.buildAttempts,
      environments: liveEnvironmentCount(planned.nextState),
      deadline: planned.nextState.trial.deadline,
    },
  }
  const rendered = `${JSON.stringify(output, null, 2)}\n`
  write(rendered)
  return output
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    runCli()
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        error: error.code ?? 'UNEXPECTED_ERROR',
        message: error.message,
      })}\n`
    )
    process.exitCode = 2
  }
}

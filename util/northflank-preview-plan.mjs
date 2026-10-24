import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { parse as parseYaml } from 'yaml'

import minimumValidation from '../.github/scripts/minimum-validation-class.cjs'
import stagingImageTargets from '../.github/scripts/staging-image-targets.cjs'
import { resolveDevrouter } from './devrouter-cli.mjs'

const { classifyPaths, isSafeRepoPath, parseNameStatusRecords } =
  minimumValidation
const { imageName, matchGlob, targetById } = stagingImageTargets

const MODULE_DIRECTORY = fileURLToPath(new URL('.', import.meta.url))
const DEFAULT_CONTRACT_PATH = resolve(
  MODULE_DIRECTORY,
  '../deploy/northflank/runtime-contract.yml'
)
const CONTRACT_PATH = 'deploy/northflank/runtime-contract.yml'
const DEVROUTER_PATH = '.devrouter.yml'
const PROFILE_CONTROL_FILES = [DEVROUTER_PATH, 'util/profile-resolver.sh']
const CONTROLLER_SOURCE_FILES = [
  ...PROFILE_CONTROL_FILES,
  '.github/scripts/minimum-validation-class.cjs',
  '.github/scripts/staging-image-targets.cjs',
  'util/devrouter-cli.mjs',
  'util/northflank-preview-plan.mjs',
]
const OPTIONAL_CONTROLLER_CONTROL_FILES = [
  '.github/workflows/northflank-previews.yml',
  'deploy/northflank/klicker-preview.json',
  'util/northflank-preview-lifecycle.mjs',
]
const PROFILE_NAME = /^[a-z0-9-]+$/
const GIT_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
const RECORD_KINDS = new Set(['A', 'M', 'D', 'R', 'C'])
const MAX_OUTPUT = 8 * 1024 * 1024

function inputError(message, code = 'INVALID_PLAN_INPUT', details) {
  const error = new Error(message)
  error.code = code
  if (details) error.details = details
  throw error
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertStrings(value, label) {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0) ||
    new Set(value).size !== value.length
  ) {
    inputError(`${label} must be an array of unique non-empty strings`)
  }
}

function optionalBoolean(value, label) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'boolean') {
    inputError(`${label} must be a boolean when supplied`)
  }
  return value
}

function optionalRepository(value, label) {
  if (value === undefined || value === null) return null
  if (
    typeof value !== 'string' ||
    value.length > 200 ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)
  ) {
    inputError(`${label} must be an exact owner/repository name`)
  }
  return value
}

function canonicalProfile(profile, allowedProfiles) {
  if (typeof profile !== 'string' || profile.length === 0) {
    inputError('A non-empty comma-separated profile is required')
  }
  const names = profile.split(',').map((name) => name.trim())
  if (names.some((name) => !PROFILE_NAME.test(name))) {
    inputError(`Unsafe profile selection: ${JSON.stringify(profile)}`)
  }
  const selected = [...new Set(names)].sort()
  if (allowedProfiles) {
    const allowed = new Set(allowedProfiles)
    const unknown = selected.filter((name) => !allowed.has(name))
    if (unknown.length > 0) {
      inputError(`Unknown Devrouter profile: ${unknown.join(', ')}`)
    }
  }
  return selected.join(',')
}

export function loadRuntimeContract(path = DEFAULT_CONTRACT_PATH) {
  let parsed
  try {
    parsed = parseYaml(readFileSync(path, 'utf8'), {
      version: '1.2',
      schema: 'core',
    })
  } catch (error) {
    inputError(`Cannot load runtime contract ${path}: ${error.message}`)
  }
  const objectKeys = [
    'sourceSelection',
    'apps',
    'managedServices',
    'managedProcesses',
    'images',
    'auxJob',
    'artifactChecks',
    'unsupportedResources',
  ]
  const listKeys = ['workerImages', 'intentTargets', 'recreationTargets']
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== 1 ||
    !objectKeys.every((key) => isRecord(parsed[key])) ||
    !listKeys.every((key) => Array.isArray(parsed[key]))
  ) {
    inputError('Runtime contract must use the schemaVersion 1 shape')
  }
  return parsed
}

function resolveDirectory(path, label) {
  try {
    const absolute = resolve(path)
    if (!statSync(absolute).isDirectory()) {
      inputError(`${label} is not a directory: ${absolute}`)
    }
    return realpathSync(absolute)
  } catch (error) {
    if (error.code === 'INVALID_PLAN_INPUT') throw error
    inputError(`${label} is unavailable: ${path}: ${error.message}`)
  }
}

function normalizeRecords(recordsOrPaths) {
  if (!Array.isArray(recordsOrPaths)) {
    inputError('Changed records must be an array')
  }
  return recordsOrPaths.map((record) => {
    if (typeof record === 'string') {
      if (!isSafeRepoPath(record)) {
        inputError(`Unsafe repository path: ${JSON.stringify(record)}`)
      }
      return { kind: 'M', paths: [record] }
    }
    if (!isRecord(record) || !RECORD_KINDS.has(record.kind)) {
      inputError('Changed record has an unsupported kind')
    }
    const count = record.kind === 'R' || record.kind === 'C' ? 2 : 1
    if (!Array.isArray(record.paths) || record.paths.length !== count) {
      inputError(`${record.kind} record must contain ${count} path(s)`)
    }
    for (const path of record.paths) {
      if (!isSafeRepoPath(path)) {
        inputError(`Unsafe repository path: ${JSON.stringify(path)}`)
      }
    }
    return { kind: record.kind, paths: [...new Set(record.paths)] }
  })
}

function pathsOf(records) {
  return [...new Set(records.flatMap((record) => record.paths))].sort()
}

function matchesAny(path, patterns) {
  return patterns.some((pattern) => matchGlob(pattern, path))
}

export function selectIntent(changedRecordsOrPaths, contract) {
  const records = normalizeRecords(changedRecordsOrPaths)
  const paths = pathsOf(records)
  const recreation = paths.filter((path) =>
    matchesAny(path, contract.recreationTargets)
  )
  const base = {
    intents: [],
    canonicalProfiles: [],
    paths,
    recreation: {
      required: recreation.length > 0,
      paths: recreation,
      reason: recreation.length > 0 ? 'seed-or-bootstrap-change' : null,
    },
    unsupportedResources: [],
    postgresFixturesRequired: false,
    auxJob: false,
  }
  const selection = (mode, extra = {}) => ({
    mode,
    reasons: [mode],
    ...base,
    ...extra,
  })
  if (paths.length === 0) return selection('no-changes')
  const documentation = minimumValidation.CHANGE_CLASS.documentationAndPlanning
  if (classifyPaths(paths).changeClass === documentation) {
    return selection('documentation-only')
  }
  const actionable = paths.filter(
    (path) => classifyPaths([path]).changeClass !== documentation
  )
  if (
    actionable.every((path) => matchesAny(path, contract.artifactChecks.match))
  ) {
    return selection('artifact-checks', {
      intents: [contract.artifactChecks.intent],
      reasons: [contract.artifactChecks.reason],
    })
  }
  if (actionable.every((path) => matchesAny(path, contract.auxJob.match))) {
    return selection('aux-job', {
      intents: [contract.auxJob.intent],
      reasons: [contract.auxJob.reason],
      canonicalProfiles: [canonicalProfile(contract.auxJob.profile)],
      postgresFixturesRequired: true,
      auxJob: true,
    })
  }
  const selected = new Map()
  const full = contract.intentTargets.find((target) => target.intent === 'full')
  for (const path of actionable) {
    const target = contract.intentTargets.find((entry) =>
      matchesAny(path, entry.match)
    ) ?? {
      intent: 'full',
      reason: 'unknown-or-shared-surface',
      profile: 'full',
      extraImages: full?.extraImages ?? [],
    }
    const intent = selected.get(target.intent) ?? {
      intent: target.intent,
      reason: target.reason,
      profile: target.profile,
      extraImages: target.extraImages ?? [],
      paths: [],
    }
    intent.paths.push(path)
    selected.set(target.intent, intent)
  }
  const intents = [...selected.values()].sort((left, right) =>
    left.intent.localeCompare(right.intent)
  )
  return selection('profile', {
    intents,
    reasons: [...new Set(intents.map((intent) => intent.reason))],
    canonicalProfiles: [
      canonicalProfile(
        intents.flatMap((intent) => intent.profile.split(',')).join(',')
      ),
    ],
    unsupportedResources: intents.some(
      (intent) => intent.intent === 'mcp-harness'
    )
      ? Object.keys(contract.unsupportedResources)
      : [],
  })
}

export function selectPreviewSource(input, contract) {
  if (!isRecord(input)) inputError('Source selection input is required')
  const eventName = input.eventName ?? 'push'
  if (eventName !== 'push' && eventName !== 'pull_request') {
    inputError(`Unsupported source event: ${String(eventName)}`)
  }
  const sourceBranch = input.sourceBranch ?? ''
  if (
    typeof sourceBranch !== 'string' ||
    sourceBranch.length > 255 ||
    sourceBranch.startsWith('-') ||
    sourceBranch.includes('..') ||
    /[\s\p{Cc}]/u.test(sourceBranch)
  ) {
    inputError(`Unsafe source branch: ${JSON.stringify(sourceBranch)}`)
  }
  const labels = input.labels ?? []
  assertStrings(labels, 'Source selection labels')
  const manualOptIn =
    optionalBoolean(input.manualOptIn, 'Manual opt-in') ?? false
  const repository = optionalRepository(input.repository, 'Source repository')
  const headRepository = optionalRepository(
    input.headRepository,
    'Source head repository'
  )
  const state = input.state ?? null
  if (state !== null && (typeof state !== 'string' || state.length > 32)) {
    inputError('Source pull request state must be a short string')
  }
  const merged = optionalBoolean(
    input.merged,
    'Source pull request merged flag'
  )
  const isFork = optionalBoolean(input.isFork, 'Source pull request fork flag')
  const approvedRepository = optionalRepository(
    contract.sourceSelection.repository,
    'Contract-approved source repository'
  )
  const branchAllowed =
    contract.sourceSelection.branchAllowlist.includes(sourceBranch)
  const common = {
    eventName,
    sourceBranch,
    labels: [...labels],
    manualOptIn,
    repository,
    headRepository,
    state,
    merged,
    isFork,
    approvedRepository,
    branchAllowlist: [...contract.sourceSelection.branchAllowlist],
    pullRequestPolicy: { ...contract.sourceSelection.pullRequest },
  }
  if (eventName === 'push') {
    let reason = null
    if (repository !== null || headRepository !== null) {
      if (repository === null || headRepository === null) {
        reason = 'push-repository-incomplete'
      } else if (repository !== headRepository) {
        reason = 'repository-mismatch'
      } else if (
        approvedRepository !== null &&
        repository !== approvedRepository
      ) {
        reason = 'repository-not-approved'
      }
    } else if (approvedRepository === null) {
      reason = 'push-repository-unknown'
    }
    if (reason === null && isFork === true) reason = 'fork-source'
    if (reason === null && !branchAllowed) reason = 'branch-not-allowlisted'
    return {
      ...common,
      eligible: reason === null,
      reason:
        reason ??
        (repository === null
          ? 'allowlisted-contract-repository'
          : 'allowlisted-branch'),
    }
  }
  const labelled = labels.includes(contract.sourceSelection.pullRequest.label)
  const manualAllowed =
    contract.sourceSelection.pullRequest.manualOptIn === true && manualOptIn
  let reason = null
  if (repository === null || headRepository === null) {
    reason = 'pull-request-repository-unknown'
  } else if (repository !== headRepository) {
    reason = 'repository-mismatch'
  } else if (approvedRepository !== null && repository !== approvedRepository) {
    reason = 'repository-not-approved'
  } else if (isFork === null) {
    reason = 'pull-request-fork-unknown'
  } else if (isFork) {
    reason = 'pull-request-fork'
  } else if (merged === null) {
    reason = 'pull-request-merge-state-unknown'
  } else if (merged || state === 'merged') {
    reason = 'pull-request-merged'
  } else if (state !== 'open') {
    reason =
      state === 'closed' ? 'pull-request-closed' : 'pull-request-state-unknown'
  } else if (!labelled && !manualAllowed) {
    reason = 'preview-opt-in-missing'
  }
  return {
    ...common,
    eligible: reason === null,
    reason:
      reason ??
      (labelled && manualAllowed
        ? 'preview-label-or-manual-opt-in'
        : labelled
          ? 'preview-label'
          : 'manual-opt-in'),
  }
}

export function validateCanonicalResolved(resolved, expected, contract) {
  if (
    !isRecord(resolved) ||
    !isRecord(resolved.managedRuntime) ||
    resolved.schemaVersion !== 1
  ) {
    inputError('Resolved profile must use the schemaVersion 1 shape')
  }
  if (resolved.profile !== expected.profile) {
    inputError(
      `Resolved profile ${resolved.profile} does not match requested ${expected.profile}`
    )
  }
  if (resolved.repoPath !== expected.root) {
    inputError(
      `Resolved profile repository ${resolved.repoPath} does not match ${expected.root}`
    )
  }
  assertStrings(resolved.apps, 'resolved.apps')
  assertStrings(resolved.managedRuntime.services, 'resolved services')
  assertStrings(resolved.managedRuntime.processes, 'resolved processes')
  const unknown = {
    apps: resolved.apps.filter(
      (name) =>
        !Object.hasOwn(contract.apps, name) &&
        !Object.hasOwn(contract.managedServices, name)
    ),
    services: resolved.managedRuntime.services.filter(
      (name) => !Object.hasOwn(contract.managedServices, name)
    ),
    processes: resolved.managedRuntime.processes.filter(
      (name) => !Object.hasOwn(contract.managedProcesses, name)
    ),
  }
  if (Object.values(unknown).some((items) => items.length > 0)) {
    inputError(
      'Resolved profile contains objects missing from the controller contract',
      'MISSING_CONTROLLER_OBJECT',
      unknown
    )
  }
  return resolved
}

export function resolveCanonicalProfile({
  profile,
  candidateRoot,
  allowedProfiles,
  resolver = resolveDevrouter,
  profileResolver,
  env = process.env,
  contract,
}) {
  const root = resolveDirectory(candidateRoot, 'candidate root')
  const canonical = canonicalProfile(profile, allowedProfiles)
  if (profileResolver) {
    return validateCanonicalResolved(
      profileResolver({ repo: root, profile: canonical, env, contract }),
      { profile: canonical, root },
      contract
    )
  }
  let binary
  try {
    binary = resolver({ repo: root, env })
  } catch (error) {
    inputError(`Cannot resolve host Devrouter: ${error.message}`)
  }
  if (typeof binary !== 'string' || !isAbsolute(binary)) {
    inputError('Devrouter resolver must return an absolute executable path')
  }
  const output = run(
    binary,
    ['profile', 'resolve', '--repo', root, '--profile', canonical, '--json'],
    { cwd: root, env },
    'Devrouter profile resolution',
    'DEVRouter_PROFILE_RESOLUTION_FAILED'
  )
  let resolved
  try {
    resolved = JSON.parse(output)
  } catch (error) {
    inputError(`Devrouter profile output is not JSON: ${error.message}`)
  }
  return validateCanonicalResolved(
    resolved,
    { profile: canonical, root },
    contract
  )
}

export function profileWantsWorkers({
  profile,
  controllerRoot,
  source,
  env = process.env,
}) {
  const root = resolveDirectory(controllerRoot, 'controller root')
  if (!source) {
    inputError(
      'Trusted worker marker source is missing',
      'WORKER_MARKER_FAILED'
    )
  }
  const result = spawnSync('/bin/bash', ['-s', '--', 'klicker-workers'], {
    cwd: root,
    env: { ...env, DEVROUTER_PROFILE: profile },
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 1024 * 1024,
    input: `${source}\nprofile_wants "$1"\n`,
  })
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    inputError(
      `Trusted worker marker failed: ${result.error?.message ?? result.stderr.trim()}`,
      'WORKER_MARKER_FAILED'
    )
  }
  return result.status === 0
}

function run(command, args, options, label, code = 'PROCESS_FAILED') {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: MAX_OUTPUT,
    ...options,
  })
  if (result.error || result.status !== 0) {
    inputError(
      `${label} failed: ${result.error?.message ?? result.stderr.trim()}`,
      code
    )
  }
  return result.stdout
}

function imageForBinding(binding, contract) {
  const entry = contract.images[binding]
  if (entry === undefined) return null
  const targetId = typeof entry === 'string' ? entry : entry.targetId
  const target = targetById(targetId)
  if (!target) {
    inputError(
      `Image binding ${binding} names missing inventory target ${targetId}`,
      'MISSING_IMAGE_INVENTORY_OBJECT'
    )
  }
  return {
    excluded: typeof entry === 'object' && entry.excluded === true,
    target,
  }
}

export function filterImageBuilds(selectedBindings, candidateRoot, contract) {
  const root = resolveDirectory(candidateRoot, 'candidate root')
  const builds = []
  const unavailable = []
  for (const binding of new Set(selectedBindings)) {
    const image = imageForBinding(binding, contract)
    if (!image || image.excluded) continue
    if (!existsSync(join(root, image.target.dockerfile))) {
      unavailable.push({
        binding,
        targetId: image.target.id,
        dockerfile: image.target.dockerfile,
      })
      continue
    }
    builds.push({
      binding,
      targetId: image.target.id,
      image: imageName(image.target),
      dockerfile: image.target.dockerfile,
      reuseEligible: image.target.reuse === true,
    })
  }
  builds.sort((left, right) => left.targetId.localeCompare(right.targetId))
  unavailable.sort((left, right) => left.targetId.localeCompare(right.targetId))
  return { builds, unavailable }
}

function imageInventory(root, contract) {
  return Object.keys(contract.images)
    .map((binding) => {
      const image = imageForBinding(binding, contract)
      return {
        binding,
        targetId: image.target.id,
        dockerfile: image.target.dockerfile,
        available: existsSync(join(root, image.target.dockerfile)),
        excluded: image.excluded,
        reuseEligible: image.target.reuse === true,
      }
    })
    .sort((left, right) => left.targetId.localeCompare(right.targetId))
}

function resourceBindings(resolved, selection, contract, workers) {
  const bindings = new Map()
  if (selection.auxJob) {
    for (const name of contract.auxJob.services) {
      if (!resolved.managedRuntime.services.includes(name)) {
        inputError(
          `Auxiliary job service ${name} is absent from the resolved profile`,
          'MISSING_RESOLVED_SERVICE'
        )
      }
      const service = contract.managedServices[name]
      bindings.set(name, {
        binding: name,
        kind: service.data ? 'data-service' : 'service',
        ...service,
      })
    }
    for (const name of contract.auxJob.extraImages) bindings.set(name, null)
    bindings.set('postgres-fixtures', {
      binding: 'postgres-fixtures',
      kind: 'fixture-job',
      ...contract.auxJob.fixtureJob,
    })
    return bindings
  }
  for (const name of resolved.apps) {
    if (name === 'blob') {
      bindings.set('azurite', {
        binding: 'azurite',
        kind: 'service',
        ...contract.managedServices.azurite,
        routes: ['blob'],
        publicListener: true,
      })
      continue
    }
    if (name === 'db') {
      bindings.set('postgres', {
        binding: 'postgres',
        kind: 'data-service',
        ...contract.managedServices.postgres,
      })
      continue
    }
    if (name === 'oidc') {
      bindings.set('oidc', {
        binding: 'oidc',
        kind: 'service',
        ...contract.managedServices.oidc,
      })
      continue
    }
    bindings.set(name, {
      binding: name,
      kind: 'app',
      ...contract.apps[name],
    })
  }
  for (const name of resolved.managedRuntime.services) {
    if (!bindings.has(name)) {
      const service = contract.managedServices[name]
      bindings.set(name, {
        binding: name,
        kind: service.data ? 'data-service' : 'service',
        ...service,
      })
    }
  }
  for (const name of resolved.managedRuntime.processes) {
    const process = contract.managedProcesses[name]
    if (process.deployable) {
      bindings.set(name, {
        binding: name,
        kind: 'process',
        ...process,
      })
    }
  }
  for (const name of selection.intents.flatMap(
    (intent) => intent.extraImages
  )) {
    bindings.set(name, null)
  }
  if (workers) {
    for (const name of contract.workerImages) bindings.set(name, null)
  }
  return bindings
}

function git(root, args, label) {
  return run('git', ['-C', root, ...args], {}, label, 'GIT_READ_FAILED').trim()
}

function gitTopLevel(root) {
  const result = spawnSync(
    'git',
    ['-C', root, 'rev-parse', '--show-toplevel'],
    {
      encoding: 'utf8',
      timeout: 10000,
    }
  )
  if (result.error || result.status !== 0) return null
  try {
    return realpathSync(result.stdout.trim())
  } catch {
    return null
  }
}

function pinnedControlFile(root, sha, path) {
  const result = spawnSync('git', ['-C', root, 'show', `${sha}:${path}`], {
    timeout: 10000,
    maxBuffer: MAX_OUTPUT,
  })
  if (result.error || result.status !== 0) return null
  return Buffer.isBuffer(result.stdout)
    ? result.stdout
    : Buffer.from(result.stdout)
}

function controlPathFromRoot(root, path, label) {
  const pathRelative = relative(root, resolve(path))
  if (
    pathRelative.length === 0 ||
    pathRelative.startsWith('..') ||
    isAbsolute(pathRelative)
  ) {
    inputError(
      `${label} must be inside its Git root`,
      'SOURCE_PROVENANCE_UNAVAILABLE'
    )
  }
  return pathRelative
}

function verifySourceRevision({ root, sha, label, files, optionalFiles = [] }) {
  const requested =
    sha === undefined || sha === null ? null : assertSha(sha, label)
  const topLevel = gitTopLevel(root)
  if (topLevel !== root) {
    if (requested !== null) {
      inputError(
        `${label} cannot be verified because its root is not the Git worktree root`,
        'SOURCE_PROVENANCE_UNAVAILABLE',
        { label, root, requested }
      )
    }
    return {
      sha: null,
      status: 'unverified',
      reason: 'not-a-git-worktree',
      root,
      files,
    }
  }
  const head = assertSha(
    git(root, ['rev-parse', 'HEAD'], `read ${label} HEAD`),
    `${label} HEAD`
  )
  const resolved = requested ?? head
  if (resolved !== head) {
    inputError(
      `${label} does not match the checked-out commit`,
      'SOURCE_PROVENANCE_MISMATCH',
      { label, requested: resolved, head, root }
    )
  }
  const optional = new Set(optionalFiles)
  const mismatches = []
  const verifiedFiles = []
  for (const path of files) {
    const pinned = pinnedControlFile(root, resolved, path)
    const working = readControlFile(root, path)
    if (optional.has(path) && !pinned && !working) continue
    if (!pinned || !working || !pinned.equals(working)) {
      mismatches.push(path)
    } else {
      verifiedFiles.push(path)
    }
  }
  if (mismatches.length > 0) {
    inputError(
      `${label} control files do not match the pinned commit`,
      'SOURCE_PROVENANCE_MISMATCH',
      { label, requested: resolved, root, files: mismatches }
    )
  }
  return {
    sha: resolved,
    status: 'verified',
    reason: requested === null ? 'checked-out-commit' : 'reported-commit',
    root,
    files: verifiedFiles,
  }
}

function controllerControlFiles(contractRelativePath) {
  return [
    ...new Set([
      ...CONTROLLER_SOURCE_FILES,
      contractRelativePath,
      ...OPTIONAL_CONTROLLER_CONTROL_FILES,
    ]),
  ].sort()
}

function assertSha(value, label) {
  if (typeof value !== 'string' || !GIT_SHA.test(value)) {
    inputError(`${label} must be a full lowercase commit SHA`)
  }
  return value
}

export function resolveCommit(root, sha, label = 'commit') {
  const directory = resolveDirectory(root, 'git root')
  const wanted = assertSha(sha, label)
  const resolved = git(
    directory,
    ['rev-parse', '--verify', `${wanted}^{commit}`],
    `resolve ${label}`
  )
  return assertSha(resolved, `resolved ${label}`)
}

export function readCumulativeChanges({ candidateRoot, base, head }) {
  const root = resolveDirectory(candidateRoot, 'candidate root')
  const baseSha = resolveCommit(root, base, 'base SHA')
  const candidateSha = resolveCommit(root, head, 'candidate SHA')
  const mergeBase = git(
    root,
    ['merge-base', baseSha, candidateSha],
    'resolve merge base'
  )
  assertSha(mergeBase, 'merge-base SHA')
  const output = run(
    'git',
    [
      '-C',
      root,
      'diff',
      '--name-status',
      '-z',
      '--find-renames',
      mergeBase,
      candidateSha,
      '--',
    ],
    {},
    'Cumulative diff',
    'GIT_DIFF_FAILED'
  )
  return {
    baseSha: mergeBase,
    candidateSha,
    records: parseNameStatusRecords(output),
  }
}

function readControlFile(root, relativePath) {
  try {
    return readFileSync(join(root, relativePath))
  } catch {
    return null
  }
}

function parseDevrouter(source, label) {
  if (!source) inputError(`Cannot read ${DEVROUTER_PATH} from ${label}`)
  let config
  try {
    config = parseYaml(source.toString('utf8'), {
      version: '1.2',
      schema: 'core',
    })
  } catch (error) {
    inputError(`Invalid ${DEVROUTER_PATH}: ${error.message}`)
  }
  if (!isRecord(config) || !isRecord(config.profiles)) {
    inputError(`${DEVROUTER_PATH} must define profiles`)
  }
  return config
}

function inspectControls(controllerRoot, candidateRoot, contract) {
  const files = PROFILE_CONTROL_FILES
  const checked = files.map((path) => {
    const controller = readControlFile(controllerRoot, path)
    const candidate = readControlFile(candidateRoot, path)
    return {
      path,
      controllerPresent: Boolean(controller),
      candidatePresent: Boolean(candidate),
      same: Boolean(controller && candidate && controller.equals(candidate)),
    }
  })
  const drift = checked.filter((file) => !file.same)
  const qualified = drift.length
    ? (contract.qualifiedProfiles ?? []).find((entry) =>
        files.every((path) => {
          const source = readControlFile(candidateRoot, path)
          return (
            source &&
            createHash('sha256').update(source).digest('hex') ===
              entry.files?.[path]
          )
        })
      )
    : null
  const profileRoot = qualified ? candidateRoot : controllerRoot
  return {
    controllerConfig: parseDevrouter(
      readControlFile(profileRoot, DEVROUTER_PATH),
      profileRoot
    ),
    candidateConfig: parseDevrouter(
      readControlFile(candidateRoot, DEVROUTER_PATH),
      candidateRoot
    ),
    helperSource: readControlFile(profileRoot, 'util/profile-resolver.sh'),
    parity: {
      status: qualified ? 'qualified' : drift.length === 0 ? 'match' : 'drift',
      files,
      drift,
      qualifiedRevision: qualified?.revision ?? null,
    },
  }
}

function unsupportedCandidateObjects(candidate, controller, contract) {
  const unsupported = []
  const add = (kind, name, reason) => unsupported.push({ kind, name, reason })
  for (const name of Object.keys(candidate.profiles)) {
    if (!Object.hasOwn(controller.profiles, name)) {
      add('profile', name, 'profile-without-controller-binding')
      if (candidate.profiles[name]?.default === true) {
        add('profile-default', name, 'unsupported-default-profile')
      }
    }
  }
  for (const entry of Array.isArray(candidate.apps) ? candidate.apps : []) {
    const name = typeof entry === 'string' ? entry : entry?.name
    if (
      typeof name === 'string' &&
      !Object.hasOwn(contract.apps, name) &&
      !Object.hasOwn(contract.managedServices, name)
    ) {
      add('app', name, 'app-without-controller-binding')
    }
  }
  const runtime = candidate.managedRuntime ?? {}
  const services = [
    ...(runtime.devcontainer?.baseServices ?? []),
    ...(runtime.devcontainer?.profileServices ?? []),
  ]
  for (const name of services) {
    if (
      typeof name === 'string' &&
      !Object.hasOwn(contract.managedServices, name)
    ) {
      add('service', name, 'service-without-controller-binding')
    }
  }
  for (const name of runtime.processes ?? []) {
    if (
      typeof name === 'string' &&
      !Object.hasOwn(contract.managedProcesses, name)
    ) {
      add('process', name, 'process-without-controller-binding')
    }
  }
  return unsupported.sort((left, right) =>
    `${left.kind}:${left.name}`.localeCompare(`${right.kind}:${right.name}`)
  )
}

function availableUnsupportedResources(root, contract) {
  return Object.entries(contract.unsupportedResources)
    .filter(([, resource]) => existsSync(join(root, resource.dockerfile)))
    .map(([name, resource]) => ({ name, ...resource }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

function sourceBranch(root) {
  const result = spawnSync(
    'git',
    ['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'],
    { encoding: 'utf8', timeout: 10000 }
  )
  if (result.error || result.status !== 0) return ''
  return result.stdout.trim() === 'HEAD' ? '' : result.stdout.trim()
}

export function buildPreviewPlan({
  controllerRoot,
  candidateRoot = controllerRoot,
  profile,
  baseSha,
  candidateSha,
  changedRecords,
  sourceSelection,
  contractPath,
  resolver = resolveDevrouter,
  profileResolver,
  controllerSha,
  workerMarker,
  env = process.env,
}) {
  const controller = resolveDirectory(controllerRoot, 'controller root')
  const candidate = resolveDirectory(candidateRoot, 'candidate root')
  const contractFile = contractPath ?? join(controller, CONTRACT_PATH)
  const contractRelativePath = controlPathFromRoot(
    controller,
    contractFile,
    'Runtime contract'
  )
  const provenance = {
    controller: verifySourceRevision({
      root: controller,
      sha: controllerSha,
      label: 'Controller revision',
      files: controllerControlFiles(contractRelativePath),
      optionalFiles: OPTIONAL_CONTROLLER_CONTROL_FILES,
    }),
    candidate: verifySourceRevision({
      root: candidate,
      sha: candidateSha,
      label: 'Candidate revision',
      files: PROFILE_CONTROL_FILES,
    }),
  }
  const contract = loadRuntimeContract(contractFile)
  const controls = inspectControls(controller, candidate, contract)
  const parity = controls.parity
  const controllerProfiles = Object.keys(controls.controllerConfig.profiles)
  const candidateDrift = unsupportedCandidateObjects(
    controls.candidateConfig,
    controls.controllerConfig,
    contract
  )
  const unsupportedResources = availableUnsupportedResources(
    candidate,
    contract
  )
  const bindingError = {
    drift: parity.drift,
    unsupportedCandidateObjects: candidateDrift,
    availableUnsupportedResources: unsupportedResources,
  }
  if (parity.status === 'drift') {
    inputError(
      'Candidate control-file drift is blocked; the approved controller governs',
      'CANDIDATE_CONTROL_DRIFT',
      bindingError
    )
  }
  if (candidateDrift.length > 0) {
    inputError(
      'Candidate Devrouter objects are not bound by the approved controller',
      'UNSUPPORTED_CANDIDATE_CONTROL',
      bindingError
    )
  }

  const selectedSource = selectPreviewSource(
    sourceSelection ?? {
      eventName: 'push',
      sourceBranch: sourceBranch(candidate),
    },
    contract
  )
  const selection = profile
    ? {
        mode: 'explicit-profile',
        intents: [
          {
            intent: 'explicit-profile',
            reason: 'explicit-profile',
            profile,
            extraImages: [],
            paths: [],
          },
        ],
        reasons: ['explicit-profile'],
        canonicalProfiles: [canonicalProfile(profile, controllerProfiles)],
        paths: [],
        recreation: { required: false, paths: [], reason: null },
        unsupportedResources: [],
        postgresFixturesRequired: false,
        auxJob: false,
      }
    : selectIntent(changedRecords ?? [], contract)

  const sha = {
    controller: provenance.controller.sha,
    base: baseSha ? assertSha(baseSha, 'base SHA') : null,
    candidate: provenance.candidate.sha,
  }
  if (sha.base) {
    try {
      resolveCommit(candidate, sha.base, 'base SHA')
    } catch (error) {
      if (error.code === 'INVALID_PLAN_INPUT') throw error
      inputError(
        'Base revision cannot be resolved in the candidate Git root',
        'SOURCE_PROVENANCE_MISMATCH',
        { base: sha.base, root: candidate }
      )
    }
  }
  if (!sha.base) sha.base = sha.candidate

  const profiles = selection.canonicalProfiles.join(',')
  const evaluateWorkers = !selection.auxJob && profiles.length > 0
  const workers = evaluateWorkers
    ? (
        workerMarker ??
        ((names, root) =>
          profileWantsWorkers({
            profile: names,
            controllerRoot: root,
            source: controls.helperSource,
            env,
          }))
      )(profiles, controller)
    : false
  if (workers !== true && workers !== false) {
    inputError('Worker marker must return a boolean')
  }

  let resolved
  if (profiles.length === 0) {
    resolved = {
      schemaVersion: 1,
      repoPath: candidate,
      profile: '',
      apps: [],
      dependencies: [],
      readiness: [],
      managedRuntime: {
        baseServices: [],
        profileServices: [],
        services: [],
        processes: [],
      },
    }
  } else {
    resolved = resolveCanonicalProfile({
      profile: profiles,
      candidateRoot: candidate,
      allowedProfiles: controllerProfiles,
      resolver,
      profileResolver,
      env,
      contract,
    })
  }

  const bindings = resourceBindings(resolved, selection, contract, workers)
  if (
    !selection.auxJob &&
    resolved.managedRuntime.processes.includes('klicker-dev')
  ) {
    const filters = run(
      '/bin/bash',
      ['-s'],
      {
        cwd: controller,
        input: `${controls.helperSource}\nprofile_turbo_filters\n`,
        env: { ...env, DEVROUTER_PROFILE: profiles },
      },
      'Trusted process image selection'
    ).trim()
    const roots = new Set(filters.split(/\s+/).filter(Boolean))
    for (const [name, process] of Object.entries(
      contract.processImages ?? {}
    )) {
      const image = imageForBinding(name, contract)
      if (
        existsSync(join(candidate, image.target.dockerfile)) &&
        (roots.size === 0 || roots.has(`--filter=${process.packageName}`))
      ) {
        bindings.set(name, {
          binding: name,
          inventoryId: name,
          kind: 'app',
          publicListener: false,
          nativePort: process.nativePort,
        })
      }
    }
  }
  const selectedBindings = [...bindings.keys()].sort()
  const filtered = filterImageBuilds(selectedBindings, candidate, contract)
  if (filtered.unavailable.length > 0) {
    inputError(
      'Selected image builds are absent from the candidate tree',
      'MISSING_CANDIDATE_IMAGE_INPUT',
      { unavailable: filtered.unavailable }
    )
  }
  if (unsupportedResources.length > 0) {
    selection.unsupportedResources = unsupportedResources.map(
      (resource) => resource.name
    )
  }
  const resources = selectedBindings.map(
    (name) =>
      bindings.get(name) ?? {
        binding: name,
        kind: 'image',
        inventoryId: name,
      }
  )
  const grouped = Object.groupBy(resources, (resource) => resource.kind)
  const names = (...kinds) =>
    kinds
      .flatMap((kind) => grouped[kind] ?? [])
      .map((resource) => resource.binding)
  const blockedReasons = [
    ...(!selectedSource.eligible ? ['source-not-eligible'] : []),
    ...(!profile && selection.mode === 'no-changes'
      ? ['source-changes-missing']
      : []),
    ...(provenance.controller.status !== 'verified' ||
    provenance.candidate.status !== 'verified'
      ? ['source-provenance-unverified']
      : []),
    ...(unsupportedResources.length > 0 ? ['unsupported-resource'] : []),
    ...(selection.recreation.required ? ['recreation-required'] : []),
  ]
  return {
    schemaVersion: 1,
    status: blockedReasons.length === 0 ? 'planning-ready' : 'blocked',
    sha,
    provenance,
    sourceSelection: selectedSource,
    controlParity: {
      status: parity.status,
      qualifiedRevision: parity.qualifiedRevision,
      controllerRoot: controller,
      candidateRoot: candidate,
      files: parity.files,
      contractSchemaVersion: contract.schemaVersion,
    },
    intentSelection: selection,
    profile: {
      requested: profile ?? null,
      canonical: selection.canonicalProfiles,
      resolved: resolved.profile || null,
    },
    apps: names('app'),
    managedServices: names('service', 'data-service').sort(),
    workerMarker: {
      evaluated: evaluateWorkers,
      selected: workers,
      images: workers ? [...contract.workerImages] : [],
    },
    resources: {
      bindings: resources,
      dataResources: names('data-service'),
    },
    images: {
      builds: filtered.builds,
      inventory: imageInventory(candidate, contract),
    },
    unsupportedResources,
    recreationRequired: selection.recreation.required,
    postgresFixturesRequired: selection.postgresFixturesRequired,
    reuseEligibility: {
      eligible: blockedReasons.length === 0,
      reasons: blockedReasons,
    },
    effects: {
      providerCredentialsRead: false,
      runtimeStarted: false,
    },
  }
}

export const renderPreviewPlan = buildPreviewPlan

function usage() {
  return `Usage: node util/northflank-preview-plan.mjs [options]

Build a side-effect-free Northflank preview plan from the controller contract.

Options:
  --profile <names>         Explicit comma-separated Devrouter profile
  --base <sha>              Base commit for a cumulative merge-base diff
  --head <sha>              Candidate commit for a cumulative merge-base diff
  --controller-root <path>  Approved controller checkout (default: cwd)
  --candidate-root <path>   Candidate checkout (default: controller root)
  --event <name>            push or pull_request (default: push)
  --source-branch <name>    Source branch for preview policy
  --preview-label <name>    Pull request label to test (repeatable)
  --manual-opt-in           Record explicit pull request opt-in
  --source-repository <id>  Base repository in owner/repository form
  --source-head-repository <id>
                            Source head repository in owner/repository form
  --source-state <state>    Pull request state: open, closed, or merged
  --source-merged <bool>    Pull request merged flag: true or false
  --source-fork <bool>      Pull request fork flag: true or false
  --help                    Print this help without reading files
`
}

function parseBooleanOption(name, value) {
  if (value !== 'true' && value !== 'false') {
    inputError(`--${name} must be true or false`)
  }
  return value === 'true'
}

function parseArgs(argv) {
  const options = { labels: [] }
  const valued = new Set([
    'profile',
    'base',
    'head',
    'controller-root',
    'candidate-root',
    'event',
    'source-branch',
    'preview-label',
    'source-repository',
    'source-head-repository',
    'source-state',
    'source-merged',
    'source-fork',
  ])
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      options.help = true
    } else if (argument === '--manual-opt-in') {
      options.manualOptIn = true
    } else {
      const name = argument.startsWith('--') ? argument.slice(2) : ''
      if (!valued.has(name) || index + 1 >= argv.length) {
        inputError(`Unknown or incomplete option: ${argument}`)
      }
      const value = argv[++index]
      if (name === 'preview-label') options.labels.push(value)
      else if (name === 'source-merged' || name === 'source-fork') {
        options[name] = parseBooleanOption(name, value)
      } else options[name] = value
    }
  }
  return options
}

export function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  if (options.help) return usage()
  if (options.profile && (options.base || options.head)) {
    inputError('Use either --profile or --base/--head, not both')
  }
  if (!options.profile && (!options.base || !options.head)) {
    inputError('Provide --profile or both --base and --head')
  }
  const controller = resolveDirectory(
    options['controller-root'] ?? process.cwd(),
    'controller root'
  )
  const candidate = resolveDirectory(
    options['candidate-root'] ?? controller,
    'candidate root'
  )
  const controllerSha = assertSha(
    git(controller, ['rev-parse', 'HEAD'], 'read controller SHA'),
    'controller SHA'
  )
  let baseSha = controllerSha
  let candidateSha
  let changedRecords = []
  if (options.profile) {
    candidateSha = assertSha(
      git(candidate, ['rev-parse', 'HEAD'], 'read candidate SHA'),
      'candidate SHA'
    )
    baseSha = candidateSha
  } else {
    const changes = readCumulativeChanges({
      candidateRoot: candidate,
      base: options.base,
      head: options.head,
    })
    baseSha = changes.baseSha
    candidateSha = changes.candidateSha
    changedRecords = changes.records
  }
  return JSON.stringify(
    buildPreviewPlan({
      controllerRoot: controller,
      candidateRoot: candidate,
      profile: options.profile,
      baseSha,
      candidateSha,
      changedRecords,
      sourceSelection: {
        eventName: options.event ?? 'push',
        sourceBranch: options['source-branch'] ?? sourceBranch(candidate),
        labels: options.labels,
        manualOptIn: options.manualOptIn === true,
        repository: options['source-repository'],
        headRepository: options['source-head-repository'],
        state: options['source-state'],
        merged: options['source-merged'],
        isFork: options['source-fork'],
      },
    }),
    null,
    2
  )
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''
if (import.meta.url === invokedPath) {
  try {
    const output = runCli()
    process.stdout.write(output.endsWith('\n') ? output : `${output}\n`)
  } catch (error) {
    const details = error.details ? ` ${JSON.stringify(error.details)}` : ''
    process.stderr.write(
      `Northflank preview planning failed: ${error.message}${details}\n`
    )
    process.exitCode = 1
  }
}

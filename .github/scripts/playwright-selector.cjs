const childProcess = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const {
  buildSelectedShardPlans,
  buildShardPlans,
  parseTimings,
  selectedDurationMap,
} = require('./get-shard-files.js')

const SELECTOR_SCHEMA_VERSION = 1
const SUPPORTED_PROFILE_VERSION = 1
const TEST_FILE_PATTERN = /^[^/]+\.spec\.ts$/

function compareNames(a, b) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function fail(message) {
  throw new Error(message)
}

function canonicalProfile(profile) {
  if (typeof profile !== 'string') {
    fail('every profile needs an app list')
  }

  const apps = profile
    .split(',')
    .map((app) => app.trim())
    .filter(Boolean)

  if (apps.length === 0) {
    fail('profile cannot be empty')
  }

  return [...new Set(apps)].sort(compareNames).join(',')
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`could not parse ${label} at ${filePath}: ${error.message}`)
  }
}

function listCandidateSpecs(candidateRoot) {
  const testsDir = path.join(candidateRoot, 'playwright/tests')
  let entries

  try {
    entries = fs.readdirSync(testsDir, { withFileTypes: true })
  } catch (error) {
    fail(`could not inventory candidate specs: ${error.message}`)
  }

  const specs = entries
    .filter((entry) => entry.isFile() && TEST_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareNames)

  if (specs.length === 0) {
    fail('candidate Playwright inventory is empty')
  }

  if (new Set(specs).size !== specs.length) {
    fail('candidate Playwright inventory contains duplicate specs')
  }

  return specs
}

function listTrustedSpecs(controlRoot) {
  const testsDir = path.join(controlRoot, 'playwright/tests')
  let entries

  try {
    entries = fs.readdirSync(testsDir, { withFileTypes: true })
  } catch (error) {
    fail(`could not inventory trusted specs: ${error.message}`)
  }

  const specs = entries
    .filter((entry) => entry.isFile() && TEST_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareNames)

  if (specs.length === 0) {
    fail('trusted Playwright inventory is empty')
  }

  return specs
}

function readRuntimeApps(controlRoot) {
  const filePath = path.join(controlRoot, 'playwright/runtime-contract.yml')
  let source

  try {
    source = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    fail(`could not read trusted runtime contract: ${error.message}`)
  }

  const apps = []
  let inApps = false

  for (const line of source.split(/\r?\n/)) {
    if (!inApps) {
      if (/^apps:\s*$/.test(line)) inApps = true
      continue
    }

    if (/^\S/.test(line) && line.trim() !== '') break

    const match = /^ {4}([a-z0-9-]+):\s*$/.exec(line)
    if (match) apps.push(match[1])
  }

  if (apps.length === 0) {
    fail('trusted runtime contract has no app mappings')
  }

  return [...new Set(apps)].sort(compareNames)
}

function readTrustedProfileNames(controlRoot) {
  const filePath = path.join(controlRoot, '.devrouter.yml')
  let source

  try {
    source = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    fail(`could not read trusted Devrouter profile contract: ${error.message}`)
  }

  const profiles = []
  let inProfiles = false
  for (const line of source.split(/\r?\n/)) {
    if (!inProfiles) {
      if (/^profiles:\s*$/.test(line)) inProfiles = true
      continue
    }

    if (/^\S/.test(line) && line.trim() !== '') break
    const match = /^ {2}([a-z0-9-]+):\s*$/.exec(line)
    if (match) profiles.push(match[1])
  }

  if (profiles.length === 0 || !profiles.includes('full')) {
    fail('trusted Devrouter profile contract must define full')
  }

  return [...new Set(profiles)].sort(compareNames)
}

function parseTrustedProfiles(controlRoot, trustedSpecs, trustedProfileNames) {
  const manifest = readJson(
    path.join(controlRoot, 'playwright/profiles.json'),
    'trusted profiles'
  )

  if (manifest?.version !== SUPPORTED_PROFILE_VERSION) {
    fail(`unsupported trusted profile schema version ${manifest?.version}`)
  }
  if (!Array.isArray(manifest.groups) || manifest.groups.length === 0) {
    fail('trusted profile groups must be a non-empty array')
  }

  const trustedProfileSet = new Set(trustedProfileNames)
  const profiles = new Map()

  for (const group of manifest.groups) {
    const profile = canonicalProfile(group?.profile)
    for (const app of profile.split(',')) {
      if (!trustedProfileSet.has(app)) {
        fail(`trusted Playwright profile ${app} is absent from Devrouter`)
      }
    }

    if (!Array.isArray(group.specs) || group.specs.length === 0) {
      fail(`trusted profile ${profile} needs specs`)
    }

    for (const spec of group.specs) {
      if (!TEST_FILE_PATTERN.test(spec) || !trustedSpecs.includes(spec)) {
        fail(`trusted profile ${profile} references invalid spec ${spec}`)
      }
      if (profiles.has(spec)) {
        fail(`trusted spec ${spec} has duplicate profile assignments`)
      }
      profiles.set(spec, profile)
    }
  }

  const missing = trustedSpecs.filter((spec) => !profiles.has(spec))
  if (missing.length > 0) {
    fail(`trusted specs without profiles: ${missing.join(', ')}`)
  }

  return profiles
}

function validateRelevanceManifest(manifest, trustedSpecs) {
  if (!manifest || manifest.version !== SELECTOR_SCHEMA_VERSION) {
    fail(`unsupported relevance manifest schema version ${manifest?.version}`)
  }
  if (!Array.isArray(manifest.groups) || manifest.groups.length === 0) {
    fail('relevance groups must be a non-empty array')
  }

  const trustedSpecSet = new Set(trustedSpecs)
  const groupIds = new Set()

  for (const group of manifest.groups) {
    if (
      typeof group?.id !== 'string' ||
      group.id.length === 0 ||
      groupIds.has(group.id)
    ) {
      fail(`invalid or duplicate relevance group ${group?.id}`)
    }
    groupIds.add(group.id)

    if (!Array.isArray(group.pathPrefixes) || group.pathPrefixes.length === 0) {
      fail(`relevance group ${group.id} needs path prefixes`)
    }
    if (!Array.isArray(group.specs) || group.specs.length === 0) {
      fail(`relevance group ${group.id} needs specs`)
    }
    if (new Set(group.specs).size !== group.specs.length) {
      fail(`relevance group ${group.id} contains duplicate specs`)
    }
    for (const spec of group.specs) {
      if (!trustedSpecSet.has(spec)) {
        fail(`relevance group ${group.id} references inactive spec ${spec}`)
      }
    }
  }

  for (const key of [
    'docsOnlyPathPrefixes',
    'docsOnlyExtensions',
    'fullPathPrefixes',
    'fullPathEquals',
    'fullPathSuffixes',
  ]) {
    if (!Array.isArray(manifest[key])) {
      fail(`relevance manifest ${key} must be an array`)
    }
  }
}

function isSafeRepoPath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.startsWith('../') &&
    !value.includes('\0')
  )
}

function parseNameStatusZ(raw) {
  const fields = raw.split('\0')
  if (fields.at(-1) === '') fields.pop()

  const changes = []
  for (let index = 0; index < fields.length; ) {
    const status = fields[index++]
    if (!/^[A-Z](?:[0-9]{1,3})?$/.test(status)) {
      fail(`malformed diff status ${JSON.stringify(status)}`)
    }

    const kind = status[0]
    const paths = []
    const pathCount = kind === 'R' || kind === 'C' ? 2 : 1
    for (let pathIndex = 0; pathIndex < pathCount; pathIndex++) {
      const changedPath = fields[index++]
      if (!isSafeRepoPath(changedPath)) {
        fail('malformed diff path')
      }
      paths.push(changedPath)
    }

    changes.push({ status, kind, paths })
  }

  if (changes.length === 0) {
    fail('diff contains no change records')
  }

  return changes
}

function runGit(candidateRoot, args) {
  try {
    return childProcess.execFileSync('git', ['-C', candidateRoot, ...args], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const detail = error.stderr?.trim() || error.message
    fail(`git ${args.join(' ')} failed: ${detail}`)
  }
}

function computeMergeBase(candidateRoot, baseSha, headSha) {
  return runGit(candidateRoot, ['merge-base', baseSha, headSha]).trim()
}

function readChangedRecords(candidateRoot, mergeBase, headSha) {
  const diff = runGit(candidateRoot, [
    'diff',
    '--name-status',
    '-z',
    '-M',
    mergeBase,
    headSha,
  ])
  return parseNameStatusZ(diff)
}

function isPrefixMatch(value, prefix) {
  if (typeof prefix !== 'string' || prefix.length === 0) return false
  const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  return value === normalizedPrefix || value.startsWith(`${normalizedPrefix}/`)
}

function classifyPath(changedPath, manifest) {
  if (manifest.fullPathEquals.includes(changedPath)) return { kind: 'full' }
  if (
    manifest.fullPathSuffixes.some(
      (suffix) =>
        typeof suffix === 'string' &&
        suffix.length > 0 &&
        changedPath.endsWith(suffix)
    )
  ) {
    return { kind: 'full' }
  }
  if (
    manifest.fullPathPrefixes.some((prefix) =>
      isPrefixMatch(changedPath, prefix)
    )
  ) {
    return { kind: 'full' }
  }

  if (
    manifest.docsOnlyPathPrefixes.some((prefix) =>
      isPrefixMatch(changedPath, prefix)
    ) ||
    manifest.docsOnlyExtensions.some(
      (extension) =>
        typeof extension === 'string' &&
        extension.length > 0 &&
        changedPath.endsWith(extension)
    )
  ) {
    return { kind: 'docs' }
  }

  const groups = manifest.groups
    .filter((group) =>
      group.pathPrefixes.some((prefix) => isPrefixMatch(changedPath, prefix))
    )
    .map((group) => group.id)

  if (groups.length > 0) return { kind: 'groups', groups }
  return { kind: 'unknown' }
}

function specFromPath(changedPath) {
  const match = /^playwright\/tests\/([^/]+\.spec\.ts)$/.exec(changedPath)
  return match?.[1] ?? null
}

function selectFromChanges({ changes, candidateSpecs, manifest, prState }) {
  if (prState !== 'draft' && prState !== 'ready') {
    fail(`unsupported pull request state ${prState}`)
  }

  const candidateSet = new Set(candidateSpecs)
  const selected = new Set()
  const reasonCodes = new Set()
  const groupIds = new Set()
  let full = prState === 'ready'

  if (prState === 'ready') reasonCodes.add('ready-for-review')
  if (changes.length === 0) {
    full = true
    reasonCodes.add('empty-diff')
  }

  const addGroup = (groupId) => {
    const group = manifest.groups.find((entry) => entry.id === groupId)
    if (!group) {
      full = true
      reasonCodes.add('unknown-group')
      return
    }
    groupIds.add(groupId)
    for (const spec of group.specs) {
      if (candidateSet.has(spec)) selected.add(spec)
    }
  }

  const classifyNonSpecPaths = (paths) => {
    const classifications = paths.map((changedPath) =>
      classifyPath(changedPath, manifest)
    )
    if (classifications.some(({ kind }) => kind === 'full')) {
      full = true
      reasonCodes.add('global-surface')
      return
    }
    if (classifications.some(({ kind }) => kind === 'unknown')) {
      full = true
      reasonCodes.add('unknown-path')
      return
    }
    for (const classification of classifications) {
      if (classification.kind === 'groups') {
        for (const groupId of classification.groups) addGroup(groupId)
      }
    }
  }

  for (const change of changes) {
    if (change.kind === 'R' || change.kind === 'C') {
      const [oldPath, newPath] = change.paths
      const oldSpec = specFromPath(oldPath)
      const newSpec = specFromPath(newPath)

      if (newSpec && candidateSet.has(newSpec)) {
        selected.add(newSpec)
        reasonCodes.add(oldSpec ? 'spec-renamed' : 'spec-added')
        if (oldSpec && !candidateSet.has(oldSpec)) {
          reasonCodes.add('spec-renamed')
        }
      } else if (oldSpec) {
        full = true
        reasonCodes.add('spec-deleted')
      } else {
        classifyNonSpecPaths([oldPath, newPath])
      }
      continue
    }

    const changedPath = change.paths[0]
    const spec = specFromPath(changedPath)
    if (spec) {
      if (change.kind === 'D') {
        full = true
        reasonCodes.add('spec-deleted')
      } else if (candidateSet.has(spec)) {
        selected.add(spec)
        reasonCodes.add(change.kind === 'A' ? 'spec-added' : 'spec-changed')
      } else {
        full = true
        reasonCodes.add('spec-deleted')
      }
    } else {
      classifyNonSpecPaths([changedPath])
    }
  }

  if (full) {
    reasonCodes.delete('documentation-only')
    return {
      mode: 'full',
      reasonCodes: [...reasonCodes].sort(compareNames),
      selectedSpecs: [...candidateSpecs],
      selectedGroupIds: [...groupIds].sort(compareNames),
    }
  }

  if (selected.size === 0) {
    reasonCodes.add('documentation-only')
    return {
      mode: 'skip',
      reasonCodes: [...reasonCodes].sort(compareNames),
      selectedSpecs: [],
      selectedGroupIds: [],
    }
  }

  if (groupIds.size > 0) reasonCodes.add('feature-group')
  return {
    mode: 'selected',
    reasonCodes: [...reasonCodes].sort(compareNames),
    selectedSpecs: [...selected].sort(compareNames),
    selectedGroupIds: [...groupIds].sort(compareNames),
  }
}

function profileAssignments({
  candidateSpecs,
  trustedProfiles,
  maximalProfile,
}) {
  const assignments = {}
  for (const spec of candidateSpecs) {
    assignments[spec] = trustedProfiles.get(spec) ?? maximalProfile
  }
  return assignments
}

function buildSelectionPlan({
  controlRoot,
  candidateSpecs,
  changes,
  baseSha,
  headSha,
  mergeBase,
  prState,
}) {
  const trustedSpecs = listTrustedSpecs(controlRoot)
  const runtimeApps = readRuntimeApps(controlRoot)
  const trustedProfileNames = readTrustedProfileNames(controlRoot)
  const trustedProfiles = parseTrustedProfiles(
    controlRoot,
    trustedSpecs,
    trustedProfileNames
  )
  const relevanceManifest = readJson(
    path.join(controlRoot, 'playwright/relevance-manifest.json'),
    'relevance manifest'
  )
  validateRelevanceManifest(relevanceManifest, trustedSpecs)

  const maximalProfile = trustedProfileNames.includes('full')
    ? 'full'
    : canonicalProfile([...trustedProfiles.values()].join(','))
  const assignments = profileAssignments({
    candidateSpecs,
    trustedProfiles,
    maximalProfile,
  })
  const selection = selectFromChanges({
    changes,
    candidateSpecs,
    manifest: relevanceManifest,
    prState,
  })
  const profileMap = new Map(Object.entries(assignments))
  const trustedTimings = readJson(
    path.join(controlRoot, 'playwright/timings.json'),
    'trusted Playwright timings'
  )
  const durationMap = parseTimings(trustedTimings, trustedSpecs, () => {})
  let shards = []

  if (selection.mode === 'selected') {
    shards = buildSelectedShardPlans(
      selection.selectedSpecs,
      durationMap,
      profileMap
    )
  } else if (selection.mode === 'full') {
    const estimates = selectedDurationMap(
      candidateSpecs,
      durationMap,
      profileMap
    )
    shards = buildShardPlans(candidateSpecs, estimates, profileMap, 8)
  }

  return {
    schemaVersion: SELECTOR_SCHEMA_VERSION,
    mode: selection.mode,
    reasonCodes: selection.reasonCodes,
    baseSha,
    headSha,
    mergeBase,
    trustedRuntimeApps: runtimeApps,
    candidateSpecs: candidateSpecs.map((spec) => `tests/${spec}`),
    selectedSpecs: selection.selectedSpecs.map((spec) => `tests/${spec}`),
    profileAssignments: Object.fromEntries(
      Object.entries(assignments).map(([spec, profile]) => [
        `tests/${spec}`,
        profile,
      ])
    ),
    selectedProfiles: [
      ...new Set(selection.selectedSpecs.map((spec) => assignments[spec])),
    ].sort(compareNames),
    selectedGroupIds: selection.selectedGroupIds,
    shardCount: shards.length,
    shards,
  }
}

function selectPlaywrightPlan({
  controlRoot,
  candidateRoot,
  baseSha,
  headSha,
  prState,
}) {
  const candidateSpecs = listCandidateSpecs(candidateRoot)
  let mergeBase = null
  let changes
  let fallbackReason = null

  try {
    mergeBase = computeMergeBase(candidateRoot, baseSha, headSha)
    changes = readChangedRecords(candidateRoot, mergeBase, headSha)
  } catch (error) {
    fallbackReason = error.message.includes('merge-base')
      ? 'history-unavailable'
      : 'malformed-diff'
    changes = [{ kind: 'M', status: 'M', paths: ['__selector_failure__'] }]
  }

  const plan = buildSelectionPlan({
    controlRoot,
    candidateSpecs,
    changes,
    baseSha,
    headSha,
    mergeBase,
    prState,
  })

  if (fallbackReason) {
    plan.mode = 'full'
    plan.reasonCodes = [fallbackReason]
    plan.selectedSpecs = plan.candidateSpecs
    plan.selectedProfiles = [
      ...new Set(
        candidateSpecs.map((spec) => plan.profileAssignments[`tests/${spec}`])
      ),
    ].sort(compareNames)
    plan.selectedGroupIds = []
  }

  return plan
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index]
    if (!value.startsWith('--') || index + 1 >= argv.length) {
      fail(`expected option value, got ${value}`)
    }
    args[value.slice(2)] = argv[++index]
  }

  for (const key of ['candidate-root', 'base-sha', 'head-sha', 'pr-state']) {
    if (!args[key]) fail(`missing --${key}`)
  }
  return args
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  const controlRoot = args['control-root']
    ? path.resolve(args['control-root'])
    : path.resolve(__dirname, '../..')
  const candidateRoot = path.resolve(args['candidate-root'])
  const plan = selectPlaywrightPlan({
    controlRoot,
    candidateRoot,
    baseSha: args['base-sha'],
    headSha: args['head-sha'],
    prState: args['pr-state'],
  })

  const serialized = `${JSON.stringify(plan, null, 2)}\n`
  if (args.output) {
    fs.writeFileSync(path.resolve(args.output), serialized)
  } else {
    process.stdout.write(serialized)
  }
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`Playwright selection failed: ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = {
  SELECTOR_SCHEMA_VERSION,
  buildSelectionPlan,
  classifyPath,
  listCandidateSpecs,
  parseNameStatusZ,
  readRuntimeApps,
  selectFromChanges,
  selectPlaywrightPlan,
  validateRelevanceManifest,
}

const childProcess = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const {
  buildSelectedShardPlans,
  buildShardPlans,
  parseTimings,
  selectedDurationMap,
} = require('./get-shard-files.js')
const {
  CHANGE_CLASS,
  classifyRecords,
  parseNameStatusRecords,
} = require('./minimum-validation-class.cjs')

const SELECTOR_SCHEMA_VERSION = 1
const SUPPORTED_PROFILE_VERSION = 1
const TEST_FILE_PATTERN = /^[^/]+\.spec\.ts$/

// Change classes whose changes cannot reach application behaviour. The
// repository-owned classifier proves them from the same merge-base diff this
// selector already reads, and the ready-state full plan is the only plan those
// classes may narrow: a bounded class selects the bounded smoke surface, a
// documentation class selects nothing, and every other diff keeps the full
// candidate suite.
const BOUNDED_ENVELOPE_CLASSES = new Set([
  CHANGE_CLASS.documentationAndPlanning,
  CHANGE_CLASS.ciOrchestration,
])

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
  const productionSpecs = new Set()

  for (const group of manifest.groups) {
    const profile = canonicalProfile(group?.profile)
    for (const app of profile.split(',')) {
      if (!trustedProfileSet.has(app)) {
        fail(`trusted Playwright profile ${app} is absent from Devrouter`)
      }
    }

    if (group.runtime !== undefined && group.runtime !== 'production-webpack') {
      fail(`unsupported trusted profile runtime ${group.runtime}`)
    }
    // Production-lane specs are designated by the trusted manifest before
    // their files land on this branch; the dedicated production workflow owns
    // them and ordinary lanes must never run them.
    const productionLane = group.runtime === 'production-webpack'

    if (!Array.isArray(group.specs) || group.specs.length === 0) {
      fail(`trusted profile ${profile} needs specs`)
    }

    for (const spec of group.specs) {
      if (!TEST_FILE_PATTERN.test(spec)) {
        fail(`trusted profile ${profile} references invalid spec ${spec}`)
      }
      if (!productionLane && !trustedSpecs.includes(spec)) {
        fail(`trusted profile ${profile} references invalid spec ${spec}`)
      }
      if (productionLane) productionSpecs.add(spec)
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

  return { profiles, productionSpecs }
}

function validateRelevanceManifest(
  manifest,
  trustedSpecs,
  productionSpecs = new Set()
) {
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
      if (!trustedSpecSet.has(spec) && !productionSpecs.has(spec)) {
        fail(`relevance group ${group.id} references inactive spec ${spec}`)
      }
    }
  }

  for (const key of [
    'docsOnlyPathPrefixes',
    'docsOnlyExtensions',
    'draftBoundedPathPrefixes',
    'draftBoundedSpecs',
    'fullPathPrefixes',
    'fullPathEquals',
    'fullPathSuffixes',
  ]) {
    if (!Array.isArray(manifest[key])) {
      fail(`relevance manifest ${key} must be an array`)
    }
  }

  if (
    new Set(manifest.draftBoundedSpecs).size !==
    manifest.draftBoundedSpecs.length
  ) {
    fail('relevance manifest draftBoundedSpecs contains duplicate specs')
  }
  for (const spec of manifest.draftBoundedSpecs) {
    if (!trustedSpecSet.has(spec) || productionSpecs.has(spec)) {
      fail(
        `relevance manifest draftBoundedSpecs needs a trusted non-production spec, got ${spec}`
      )
    }
  }
}

// Rename-aware diff records come from the shared classifier parser, so the
// selector and the codebase check read one definition of a changed diff.
const parseNameStatusZ = parseNameStatusRecords

function runGit(candidateRoot, args) {
  // Hooks export repository-local Git variables. Candidate commands must use
  // the repository selected by `-C`, even when the selector runs in a hook.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  )

  try {
    return childProcess.execFileSync('git', ['-C', candidateRoot, ...args], {
      encoding: 'utf8',
      env,
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

function classifyPath(changedPath, manifest, { boundedSurface }) {
  // The bounded smoke selection covers changes that cannot alter application
  // behaviour: the repository's own CI definitions and CI-owned scripts. It
  // applies to a draft that the smart-draft control admits and to any change
  // the minimum validation envelope classified as bounded, so the same surface
  // serves both selections. Every other diff reaches the full candidate suite.
  if (
    boundedSurface &&
    manifest.draftBoundedPathPrefixes.some((prefix) =>
      isPrefixMatch(changedPath, prefix)
    )
  ) {
    return { kind: 'bounded' }
  }

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

function selectFromChanges({
  changes,
  candidateSpecs,
  manifest,
  prState,
  productionSet = new Set(),
}) {
  if (prState !== 'draft' && prState !== 'ready') {
    fail(`unsupported pull request state ${prState}`)
  }

  // The minimum validation envelope is derived from the same records this
  // selection consumes, so one trusted classification serves every lane. An
  // empty, unresolvable, renamed, or application-touching diff classifies as
  // the application envelope and keeps the full plan.
  const envelope = classifyRecords(changes)
  const boundedEnvelope = BOUNDED_ENVELOPE_CLASSES.has(envelope.changeClass)
  // The bounded smoke surface serves a draft the smart-draft control admitted
  // and any diff the minimum validation envelope classified as bounded.
  const boundedSurface = prState === 'draft' || boundedEnvelope
  const candidateSet = new Set(candidateSpecs)
  const selected = new Set()
  const reasonCodes = new Set()
  const groupIds = new Set()
  let full = prState === 'ready' && !boundedEnvelope
  // A bounded surface only intends the smoke specs. Track whether one was
  // actually selectable so a candidate tree that lost the bounded spec cannot
  // masquerade as a documentation-only diff.
  let boundedSurfaceSeen = false
  let boundedSpecSelected = false

  if (prState === 'ready' && !boundedEnvelope)
    reasonCodes.add('ready-for-review')
  if (boundedEnvelope) reasonCodes.add(`envelope-${envelope.changeClass}`)
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
      classifyPath(changedPath, manifest, { boundedSurface })
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
      if (classification.kind === 'bounded') {
        reasonCodes.add('draft-bounded-surface')
        boundedSurfaceSeen = true
        for (const spec of manifest.draftBoundedSpecs) {
          if (candidateSet.has(spec)) {
            selected.add(spec)
            boundedSpecSelected = true
          }
        }
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
      } else if (oldSpec && productionSet.has(oldSpec)) {
        // Production-lane spec changes are owned by the dedicated workflow.
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
      if (productionSet.has(spec)) {
        // Production-lane spec changes are owned by the dedicated workflow.
      } else if (change.kind === 'D') {
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

  // A bounded surface that selected nothing means the bounded spec is missing
  // from the candidate tree, not that the change was documentation. Running the
  // full candidate suite keeps that case honest instead of reporting a skip.
  if (boundedSurfaceSeen && !boundedSpecSelected) {
    full = true
    reasonCodes.add('draft-bounded-fallback')
  }

  if (full) {
    reasonCodes.delete('documentation-only')
    return {
      envelopeClass: envelope.changeClass,
      mode: 'full',
      reasonCodes: [...reasonCodes].sort(compareNames),
      selectedSpecs: [...candidateSpecs],
      selectedGroupIds: [...groupIds].sort(compareNames),
    }
  }

  if (selected.size === 0) {
    reasonCodes.add('documentation-only')
    return {
      envelopeClass: envelope.changeClass,
      mode: 'skip',
      reasonCodes: [...reasonCodes].sort(compareNames),
      selectedSpecs: [],
      selectedGroupIds: [],
    }
  }

  if (groupIds.size > 0) reasonCodes.add('feature-group')
  return {
    envelopeClass: envelope.changeClass,
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
  const { profiles: trustedProfiles, productionSpecs } = parseTrustedProfiles(
    controlRoot,
    trustedSpecs,
    trustedProfileNames
  )
  // Only trusted control can move an existing spec out of ordinary shards.
  // Production-lane specs always run in the dedicated production workflow,
  // and remaining candidate-only specs retain the maximal-profile fallback
  // until they land.
  const productionSet = new Set(productionSpecs)
  candidateSpecs = candidateSpecs.filter((spec) => !productionSet.has(spec))
  const relevanceManifest = readJson(
    path.join(controlRoot, 'playwright/relevance-manifest.json'),
    'relevance manifest'
  )
  validateRelevanceManifest(relevanceManifest, trustedSpecs, productionSet)

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
    productionSet,
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
    envelopeClass: selection.envelopeClass,
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
    // A diff the selector could not resolve never stays bounded.
    plan.envelopeClass = CHANGE_CLASS.application
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
  BOUNDED_ENVELOPE_CLASSES,
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

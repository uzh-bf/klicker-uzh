import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import {
  buildSelectedShardPlans,
  buildShardPlans,
  canonicalProfile,
  parseTimings,
  productionSpecs,
  selectedDurationMap,
} from './playwright-shards.ts'

export const ROUTE_SCHEMA_VERSION = 1
export const PLAN_SCHEMA_VERSION = 1
export const SELECTOR_SCHEMA_VERSION = 1
export const SUPPORTED_PROFILE_VERSION = 1
const TEST_FILE_PATTERN = /^[^/]+\.spec\.ts$/

type Route = 'hosted' | 'public-pr'
type SelectorPrState = 'draft' | 'ready'
type PlanMode = 'skip' | 'selected' | 'full'

export interface RouteInput {
  eventName?: string
  repository?: string
  repositoryPrivate?: string
  headRepository?: string
  prAuthor?: string
  prDraft?: string
  pullRequestNumber?: string
  publicRolloutEnabled?: string
  publicRolloutCanaryPr?: string
  smartDraftEnabled?: string
  smartDraftCanaryPr?: string
  forceHostedCanaryPr?: string
  requestedRoute?: unknown
}

export interface RouteDecision {
  schemaVersion: number
  route: Route
  selectorPrState: SelectorPrState
  reasonCodes: string[]
}

interface RelevanceGroup {
  id: string
  pathPrefixes: string[]
  specs: string[]
}

type PathClassification =
  | { kind: 'full' }
  | { kind: 'docs' }
  | { kind: 'groups'; groups: string[] }
  | { kind: 'unknown' }

interface RelevanceManifest {
  version: number
  groups: RelevanceGroup[]
  docsOnlyPathPrefixes: string[]
  docsOnlyExtensions: string[]
  fullPathPrefixes: string[]
  fullPathEquals: string[]
  fullPathSuffixes: string[]
}

interface ProfileManifest {
  version: number
  groups: Array<{
    profile: string
    specs: string[]
    runtime?: unknown
  }>
}

interface ShardPlan {
  version: number
  shardIndex: number
  shardTotal: number
  files: string[]
  estimatedDuration: number
  profile: string
}

export interface PlaywrightPlan {
  schemaVersion: number
  mode: PlanMode
  reasonCodes: string[]
  baseSha: string
  headSha: string
  mergeBase: string | null
  trustedRuntimeApps: string[]
  candidateSpecs: string[]
  selectedSpecs: string[]
  profileAssignments: Record<string, string>
  selectedProfiles: string[]
  selectedGroupIds: string[]
  shardCount: number
  shards: ShardPlan[]
}

interface ChangeRecord {
  status: string
  kind: string
  paths: string[]
}

interface SelectionResult {
  mode: PlanMode
  reasonCodes: string[]
  selectedSpecs: string[]
  selectedGroupIds: string[]
}

export interface PlanMetadata {
  route: Route
  mode: PlanMode
  selectorPrState: SelectorPrState
  shouldRun: boolean
  shardMatrix: { include: Array<{ shardIndex: number; shardTotal: number }> }
  reasonCodes: string[]
}

interface PlanMetadataInput {
  schemaVersion: number
  mode: PlanMode
  shardCount: number
  reasonCodes: string[]
  shards: Array<{
    shardIndex: number
    shardTotal: number
    files: string[]
  }>
}
type RouteMetadataInput = Pick<RouteDecision, 'route' | 'selectorPrState'>

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function compareNames(a: string, b: string) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function fail(message: string): never {
  throw new Error(message)
}

function readJson(filePath: string, label: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`could not parse ${label} at ${filePath}: ${errorMessage(error)}`)
  }
}

function listCandidateSpecs(candidateRoot: string): string[] {
  const testsDir = path.join(candidateRoot, 'playwright/tests')
  let entries: fs.Dirent[]

  try {
    entries = fs.readdirSync(testsDir, { withFileTypes: true })
  } catch (error) {
    fail(`could not inventory candidate specs: ${errorMessage(error)}`)
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

function listTrustedSpecs(controlRoot: string): string[] {
  const testsDir = path.join(controlRoot, 'playwright/tests')
  let entries: fs.Dirent[]

  try {
    entries = fs.readdirSync(testsDir, { withFileTypes: true })
  } catch (error) {
    fail(`could not inventory trusted specs: ${errorMessage(error)}`)
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

export function readRuntimeApps(controlRoot: string): string[] {
  const filePath = path.join(controlRoot, 'playwright/runtime-contract.yml')
  let source: string

  try {
    source = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    fail(`could not read trusted runtime contract: ${errorMessage(error)}`)
  }

  const apps: string[] = []
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

function readTrustedProfileNames(controlRoot: string): string[] {
  const filePath = path.join(controlRoot, '.devrouter.yml')
  let source: string

  try {
    source = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    fail(
      `could not read trusted Devrouter profile contract: ${errorMessage(error)}`
    )
  }

  const profiles: string[] = []
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

function parseTrustedProfiles(
  controlRoot: string,
  trustedSpecs: string[],
  trustedProfileNames: string[]
): Map<string, string> {
  const manifest = readJson(
    path.join(controlRoot, 'playwright/profiles.json'),
    'trusted profiles'
  ) as ProfileManifest

  if (manifest?.version !== SUPPORTED_PROFILE_VERSION) {
    fail(`unsupported trusted profile schema version ${manifest?.version}`)
  }
  if (!Array.isArray(manifest.groups) || manifest.groups.length === 0) {
    fail('trusted profile groups must be a non-empty array')
  }

  const trustedProfileSet = new Set(trustedProfileNames)
  const profiles = new Map<string, string>()

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

export function validateRelevanceManifest(
  manifest: RelevanceManifest,
  trustedSpecs: string[]
) {
  if (!manifest || manifest.version !== SELECTOR_SCHEMA_VERSION) {
    fail(`unsupported relevance manifest schema version ${manifest?.version}`)
  }
  if (!Array.isArray(manifest.groups) || manifest.groups.length === 0) {
    fail('relevance groups must be a non-empty array')
  }

  const trustedSpecSet = new Set(trustedSpecs)
  const groupIds = new Set<string>()

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
    if (!Array.isArray(manifest[key as keyof RelevanceManifest])) {
      fail(`relevance manifest ${key} must be an array`)
    }
  }
}

function isSafeRepoPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.startsWith('../') &&
    !value.includes('\0')
  )
}

export function parseNameStatusZ(raw: string): ChangeRecord[] {
  if (raw === '') return []

  const fields = raw.split('\0')
  if (fields.at(-1) === '') fields.pop()

  const changes: ChangeRecord[] = []
  for (let index = 0; index < fields.length; ) {
    const status = fields[index++]
    if (!/^[A-Z](?:[0-9]{1,3})?$/.test(status)) {
      fail(`malformed diff status ${JSON.stringify(status)}`)
    }

    const kind = status[0]
    const paths: string[] = []
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

  return changes
}

function runGit(candidateRoot: string, args: string[]): string {
  // Hooks export repository-local Git variables. Candidate commands must use
  // the repository selected by `-C`, even when the selector runs in a hook.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  )

  try {
    return execFileSync('git', ['-C', candidateRoot, ...args], {
      encoding: 'utf8',
      env,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const detail =
      isRecord(error) && typeof error.stderr === 'string'
        ? error.stderr.trim()
        : errorMessage(error)
    fail(`git ${args.join(' ')} failed: ${detail}`)
  }
}

function computeMergeBase(
  candidateRoot: string,
  baseSha: string,
  headSha: string
): string {
  return runGit(candidateRoot, ['merge-base', baseSha, headSha]).trim()
}

function readChangedRecords(
  candidateRoot: string,
  mergeBase: string,
  headSha: string
): ChangeRecord[] {
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

function isPrefixMatch(value: string, prefix: unknown): boolean {
  if (typeof prefix !== 'string' || prefix.length === 0) return false
  const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  return value === normalizedPrefix || value.startsWith(`${normalizedPrefix}/`)
}

export function classifyPath(
  changedPath: string,
  manifest: RelevanceManifest
): PathClassification {
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

function specFromPath(changedPath: string): string | null {
  const match = /^playwright\/tests\/([^/]+\.spec\.ts)$/.exec(changedPath)
  return match?.[1] ?? null
}

export function selectFromChanges({
  changes,
  candidateSpecs,
  manifest,
  prState,
}: {
  changes: ChangeRecord[]
  candidateSpecs: string[]
  manifest: RelevanceManifest
  prState: SelectorPrState
}): SelectionResult {
  if (prState !== 'draft' && prState !== 'ready') {
    fail(`unsupported pull request state ${prState}`)
  }

  const candidateSet = new Set(candidateSpecs)
  const selected = new Set<string>()
  const reasonCodes = new Set<string>()
  const groupIds = new Set<string>()
  let full = prState === 'ready'

  if (prState === 'ready') reasonCodes.add('ready-for-review')
  if (changes.length === 0) {
    full = true
    reasonCodes.add('empty-diff')
  }

  const addGroup = (groupId: string) => {
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

  const classifyNonSpecPaths = (paths: string[]) => {
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
}: {
  candidateSpecs: string[]
  trustedProfiles: Map<string, string>
  maximalProfile: string
}): Record<string, string> {
  const assignments: Record<string, string> = {}
  for (const spec of candidateSpecs) {
    assignments[spec] = trustedProfiles.get(spec) ?? maximalProfile
  }
  return assignments
}

export function buildSelectionPlan({
  controlRoot,
  candidateSpecs,
  changes,
  baseSha,
  headSha,
  mergeBase,
  prState,
}: {
  controlRoot: string
  candidateSpecs: string[]
  changes: ChangeRecord[]
  baseSha: string
  headSha: string
  mergeBase: string | null
  prState: SelectorPrState
}): PlaywrightPlan {
  const trustedSpecs = listTrustedSpecs(controlRoot)
  const runtimeApps = readRuntimeApps(controlRoot)
  const trustedProfileNames = readTrustedProfileNames(controlRoot)
  const trustedProfiles = parseTrustedProfiles(
    controlRoot,
    trustedSpecs,
    trustedProfileNames
  )
  const production = new Set(
    productionSpecs(
      readJson(
        path.join(controlRoot, 'playwright/profiles.json'),
        'trusted profiles'
      ),
      trustedSpecs
    )
  )
  // Only trusted control can move an existing spec out of ordinary shards.
  // Candidate-only specs retain the maximal-profile fallback until it lands.
  candidateSpecs = candidateSpecs.filter((spec) => !production.has(spec))
  const relevanceManifest = readJson(
    path.join(controlRoot, 'playwright/relevance-manifest.json'),
    'relevance manifest'
  ) as RelevanceManifest
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
    prState: prState as SelectorPrState,
  })
  const profileMap = new Map(Object.entries(assignments))
  const trustedTimings = readJson(
    path.join(controlRoot, 'playwright/timings.json'),
    'trusted Playwright timings'
  )
  const durationMap = parseTimings(trustedTimings, trustedSpecs, () => {})
  let shards: ShardPlan[] = []

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

export function selectPlaywrightPlan({
  controlRoot,
  candidateRoot,
  baseSha,
  headSha,
  prState,
}: {
  controlRoot: string
  candidateRoot: string
  baseSha: string
  headSha: string
  prState: SelectorPrState
}): PlaywrightPlan {
  const candidateSpecs = listCandidateSpecs(candidateRoot)
  let mergeBase = null
  let changes: ChangeRecord[]
  let fallbackReason = null

  try {
    mergeBase = computeMergeBase(candidateRoot, baseSha, headSha)
    changes = readChangedRecords(candidateRoot, mergeBase, headSha)
  } catch (error) {
    fallbackReason = errorMessage(error).includes('merge-base')
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
        plan.candidateSpecs.map((spec) => plan.profileAssignments[spec])
      ),
    ].sort(compareNames)
    plan.selectedGroupIds = []
  }

  return plan
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index]
    if (!value.startsWith('--') || index + 1 >= argv.length) {
      fail(`expected option value, got ${value}`)
    }
    args[value.slice(2)] = argv[++index]
  }

  return args
}

function parseSelectorArgs(argv: string[]): Record<string, string> {
  const args = parseArgs(argv)
  for (const key of ['candidate-root', 'base-sha', 'head-sha', 'pr-state']) {
    if (!args[key]) fail(`missing --${key}`)
  }
  return args
}

function writeJsonOutput(value: unknown, output?: string) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`
  if (output) {
    fs.writeFileSync(path.resolve(output), serialized)
  } else {
    process.stdout.write(serialized)
  }
}

export function choosePlaywrightRoute(input: RouteInput): RouteDecision {
  const requestedRoute =
    input.requestedRoute === undefined ? 'auto' : input.requestedRoute
  const normalizedRequestedRoute =
    typeof requestedRoute === 'string'
      ? requestedRoute.trim() || 'auto'
      : requestedRoute
  if (normalizedRequestedRoute !== 'auto') {
    fail(`unsupported requested route ${JSON.stringify(requestedRoute)}`)
  }
  if (input.eventName !== 'pull_request' && input.eventName !== 'push') {
    fail(`unsupported event ${JSON.stringify(input.eventName)}`)
  }

  if (input.eventName === 'push') {
    return {
      schemaVersion: ROUTE_SCHEMA_VERSION,
      route: 'hosted',
      selectorPrState: 'ready',
      reasonCodes: ['push'],
    }
  }

  const reasons: string[] = []
  const nonEmptyString = (value: unknown) =>
    typeof value === 'string' && value.trim().length > 0
  const validRepository = nonEmptyString(input.repository)
  const validHeadRepository = nonEmptyString(input.headRepository)
  const validAuthor = nonEmptyString(input.prAuthor)
  const validPullRequestNumber =
    typeof input.pullRequestNumber === 'string' &&
    /^[1-9]\d*$/.test(input.pullRequestNumber)
  const samePublicRepository =
    input.repositoryPrivate === 'false' &&
    validRepository &&
    validHeadRepository &&
    input.headRepository === input.repository
  const bot =
    typeof input.prAuthor === 'string' &&
    input.prAuthor.toLowerCase().endsWith('[bot]')
  const validDraft = input.prDraft === 'true' || input.prDraft === 'false'
  const exactCanaryMatch = (value: unknown) =>
    typeof value === 'string' &&
    value.length > 0 &&
    value === String(input.pullRequestNumber)
  const forceHosted = exactCanaryMatch(input.forceHostedCanaryPr)
  const publicRollout =
    input.publicRolloutEnabled === 'true' ||
    exactCanaryMatch(input.publicRolloutCanaryPr)
  const smartDraft =
    input.smartDraftEnabled === 'true' ||
    exactCanaryMatch(input.smartDraftCanaryPr)

  if (!validRepository || !validHeadRepository)
    reasons.push('invalid-repository')
  if (!validAuthor) reasons.push('invalid-author')
  if (!validPullRequestNumber) reasons.push('invalid-pull-request')
  if (input.repositoryPrivate !== 'false') reasons.push('private-repository')
  if (input.headRepository !== input.repository) reasons.push('fork')
  if (bot) reasons.push('bot')
  if (!validDraft) reasons.push('invalid-draft-state')

  const publicEligible =
    samePublicRepository &&
    validAuthor &&
    validPullRequestNumber &&
    !bot &&
    validDraft
  if (forceHosted) reasons.push('force-hosted-canary')

  if (input.prDraft === 'true' && publicEligible && smartDraft) {
    reasons.push('smart-draft-enabled')
    return {
      schemaVersion: ROUTE_SCHEMA_VERSION,
      route: publicRollout && !forceHosted ? 'public-pr' : 'hosted',
      selectorPrState: 'draft',
      reasonCodes: [
        ...new Set([
          ...reasons,
          publicRollout && !forceHosted
            ? 'public-pr-rollout'
            : 'hosted-fallback',
        ]),
      ].sort(compareNames),
    }
  }

  if (input.prDraft === 'true' && !smartDraft) {
    reasons.push('smart-draft-disabled')
  }
  const publicReady =
    input.prDraft === 'false' && publicEligible && publicRollout && !forceHosted
  if (publicReady) reasons.push('public-pr-rollout')
  else reasons.push('hosted-fallback')

  return {
    schemaVersion: ROUTE_SCHEMA_VERSION,
    route: publicReady ? 'public-pr' : 'hosted',
    selectorPrState: 'ready',
    reasonCodes: [...new Set(reasons)].sort(compareNames),
  }
}

export function envInput(env: NodeJS.ProcessEnv = process.env): RouteInput {
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

export function buildPlanMetadata(
  plan: PlanMetadataInput,
  routeDecision: RouteMetadataInput
): PlanMetadata {
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
  if (!['draft', 'ready'].includes(routeDecision.selectorPrState)) {
    fail(
      `unsupported selector pull-request state ${routeDecision.selectorPrState}`
    )
  }
  if (routeDecision.selectorPrState === 'ready' && plan.mode !== 'full') {
    fail('ready execution must use the full Playwright plan')
  }
  if (routeDecision.selectorPrState === 'ready' && plan.shardCount !== 8) {
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
    return { shardIndex: shard.shardIndex, shardTotal: shard.shardTotal }
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
    mode: plan.mode,
    selectorPrState: routeDecision.selectorPrState,
    shouldRun: plan.mode !== 'skip',
    shardMatrix: { include },
    reasonCodes,
  }
}

export function writeGithubOutputs(metadata: PlanMetadata, outputPath: string) {
  const lines = [
    `route=${metadata.route}`,
    `mode=${metadata.mode}`,
    `selector_pr_state=${metadata.selectorPrState}`,
    `should_run=${metadata.shouldRun}`,
    `shard_matrix=${JSON.stringify(metadata.shardMatrix)}`,
    `reason_codes=${metadata.reasonCodes.join(',')}`,
  ]
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`)
}

function runSelectionCommand(argv: string[]) {
  const args = parseSelectorArgs(argv)
  const controlRoot = args['control-root']
    ? path.resolve(args['control-root'])
    : path.resolve(import.meta.dirname, '../..')
  const candidateRoot = path.resolve(args['candidate-root'])
  const plan = selectPlaywrightPlan({
    controlRoot,
    candidateRoot,
    baseSha: args['base-sha'],
    headSha: args['head-sha'],
    prState: args['pr-state'] as SelectorPrState,
  })

  writeJsonOutput(plan, args.output)
}

export function main(argv = process.argv.slice(2), env = process.env) {
  if (argv[0] === 'select') {
    runSelectionCommand(argv.slice(1))
    return
  }

  const args = parseArgs(argv)
  for (const key of [
    'control-root',
    'candidate-root',
    'base-sha',
    'head-sha',
    'output',
    'route-output',
    'github-output',
  ]) {
    if (!args[key]) fail(`missing --${key}`)
  }
  const controlRoot = path.resolve(args['control-root'])
  const candidateRoot = path.resolve(args['candidate-root'])
  const route = choosePlaywrightRoute(envInput(env))
  const plan = selectPlaywrightPlan({
    controlRoot,
    candidateRoot,
    baseSha: args['base-sha'],
    headSha: args['head-sha'],
    prState: route.selectorPrState,
  })
  const metadata = buildPlanMetadata(plan, route)
  writeJsonOutput(plan, args.output)
  writeJsonOutput(route, args['route-output'])
  writeGithubOutputs(metadata, args['github-output'])
}

if (import.meta.main) {
  try {
    main()
  } catch (error) {
    console.error(`Playwright plan failed: ${errorMessage(error)}`)
    process.exitCode = 1
  }
}

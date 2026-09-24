import {
  getDefaultKBGraphDomainCatalog,
  hashKBContentDigestEntries,
  resolveKBGraphDomainSelection,
} from '@klicker-uzh/knowledge-graph'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import { KB_GRAPH_DATABASE_INT_MAX } from './kbGraphContract.js'
import {
  evaluateKBGraphSystemOwner,
  getKBGraphPreparationStatus,
  KB_GRAPH_PREPARATION_QUALITY_TIER,
  KB_GRAPH_SYSTEM_OWNER_SELECT,
  type KBGraphBuildServiceContext,
  type KBGraphPreparationIdentity,
  type KBGraphPreparationPendingReason,
  type KBGraphPreparationTiming,
  type KBGraphSystemOwnerAdmission,
  startKbKnowledgeGraphBuild,
} from './knowledge.js'
import {
  getKBGraphEstimate,
  requireKBGraphCostConfiguration,
} from './knowledgeGraphCost.js'

const MINUTE_MS = 60_000
const KB_GRAPH_PREPARATION_PAGE_SIZE = 100
const KB_GRAPH_PREPARATION_MAX_PAGES = 20
// Build history read per KB; failures of other preparations may sit in between
// failures of the one that is currently desired.
const KB_GRAPH_PREPARATION_RECENT_BUILDS = 20
// Consecutive failures double the backoff up to this ceiling.
const KB_GRAPH_PREPARATION_MAX_BACKOFF_MS = 24 * 60 * MINUTE_MS

/**
 * Operator policy of scheduled graph preparation, read from the environment
 * of the worker that runs the sweep.
 */
export interface KBGraphPreparationScheduleConfig {
  /** Serving or settings changes younger than this defer a pending build. */
  quietPeriodMs: number
  /** Pending longer than this, a build no longer waits for a quiet period. */
  maxDeferralMs: number
  /** Wait after a failed build; doubles per consecutive failure. */
  failureBackoffMs: number
  /** Consecutive failures on unchanged sources before the KB needs attention. */
  maxConsecutiveFailures: number
  /** Graph builds that may be queued or processing at once, across all KBs. */
  concurrencyCap: number
  /** Semester quota each owner keeps free for interactive generation. */
  headroomMinorUnits: number
}

function parseBoundedInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const value = env[name]?.trim()
  if (value === undefined || value === '') return fallback
  const parsed = /^(?:0|[1-9]\d*)$/.test(value) ? Number(value) : Number.NaN
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`)
  }
  return parsed
}

export function getKBGraphPreparationScheduleConfig(
  env: NodeJS.ProcessEnv = process.env
): KBGraphPreparationScheduleConfig {
  const quietPeriodMinutes = parseBoundedInteger(
    env,
    'KB_GRAPH_AUTO_PREPARATION_QUIET_PERIOD_MINUTES',
    45,
    30,
    60
  )
  const maxDeferralMinutes = parseBoundedInteger(
    env,
    'KB_GRAPH_AUTO_PREPARATION_MAX_DEFERRAL_MINUTES',
    240,
    quietPeriodMinutes,
    24 * 60
  )
  const failureBackoffMinutes = parseBoundedInteger(
    env,
    'KB_GRAPH_AUTO_PREPARATION_FAILURE_BACKOFF_MINUTES',
    60,
    15,
    24 * 60
  )
  return {
    quietPeriodMs: quietPeriodMinutes * MINUTE_MS,
    maxDeferralMs: maxDeferralMinutes * MINUTE_MS,
    failureBackoffMs: failureBackoffMinutes * MINUTE_MS,
    maxConsecutiveFailures: parseBoundedInteger(
      env,
      'KB_GRAPH_AUTO_PREPARATION_MAX_CONSECUTIVE_FAILURES',
      3,
      1,
      10
    ),
    concurrencyCap: parseBoundedInteger(
      env,
      'KB_GRAPH_AUTO_PREPARATION_CONCURRENCY',
      2,
      1,
      50
    ),
    headroomMinorUnits: parseBoundedInteger(
      env,
      'KB_GRAPH_AUTO_PREPARATION_HEADROOM_MINOR_UNITS',
      0,
      0,
      KB_GRAPH_DATABASE_INT_MAX
    ),
  }
}

export type KBGraphPreparationSkipReason =
  /** The published graph already represents the desired preparation. */
  | 'CURRENT'
  | 'QUIET_PERIOD'
  | 'BACKOFF'
  /** Repeated failures of the unchanged desired preparation; operations must look first. */
  | 'FAILURE_LIMIT'
  | 'QUOTA_HEADROOM'
  /** The reservation itself was refused by the owner's semester quota. */
  | 'QUOTA'
  /** AI entitlement or graph rollout flags refuse the owner. */
  | 'OWNER_NOT_ADMITTED'
  /** No explicit subject and language this deployment and owner can honor. */
  | 'UNSUPPORTED_SETTINGS'
  | 'ALREADY_ACTIVE'
  /** An ambiguous earlier dispatch holds the slot for manual review. */
  | 'NEEDS_REVIEW'
  /** Due, but the concurrency cap is reached for this sweep. */
  | 'CAPACITY'
  | 'ERROR'

/** Everything the sweep reads about one KB, loaded in bounded pages. */
export interface KBGraphPreparationCandidate {
  kbId: string
  ownerId: string
  /** Last subject, language or opt-in change; the KB is eligible from here. */
  graphSettingsChangedAt: Date
  domainPolicyId: string | null
  domainPolicyVersion: number | null
  domainPolicyLanguage: string | null
  /** Serving course-content resources in id order: what a build snapshots. */
  servingResources: Array<{
    id: string
    activeContentSha256: string
    createdAt: Date
    /**
     * Creation of the earliest ingestion attempt for the serving version,
     * preferring attempts that recorded the serving digest. Unlike the
     * resource's `updatedAt`, later ingestion writes never move it.
     */
    servingVersionRequestedAt: Date | null
  }>
  /** Latest update of any resource of the KB, deleted or administrative ones included. */
  lastResourceChangeAt: Date | null
  activeBuild: {
    status: DB.KBGraphBuildStatus
    errorCode: string | null
  } | null
  published:
    | (KBGraphPreparationIdentity & {
        buildId: string
        createdAt: Date
        /** The published build's source snapshot. */
        sources: Array<{ resourceId: string; contentSha256: string }>
      })
    | null
  /** Snapshot resources of the published build that were deleted since. */
  deletedPublishedSources: Array<{ resourceId: string; deletedAt: Date }>
  /** Newest builds first, at most `KB_GRAPH_PREPARATION_RECENT_BUILDS`. */
  recentBuilds: Array<
    KBGraphPreparationIdentity & {
      status: DB.KBGraphBuildStatus
      finishedAt: Date | null
      updatedAt: Date
    }
  >
}

export type KBGraphPreparationClassification =
  | { kind: 'due'; pendingSinceAt: Date }
  | {
      kind: 'skip'
      reason: KBGraphPreparationSkipReason
      /** Set whenever the preparation is pending, for the oldest-unmet age. */
      pendingSinceAt: Date | null
    }

function earliest(dates: Date[]): Date | null {
  return dates.reduce<Date | null>(
    (min, date) => (min === null || date < min ? date : min),
    null
  )
}

function latest(dates: Array<Date | null>): Date | null {
  return dates.reduce<Date | null>(
    (max, date) => (date !== null && (max === null || date > max) ? date : max),
    null
  )
}

function sameKBGraphPreparationIdentity(
  a: KBGraphPreparationIdentity,
  b: KBGraphPreparationIdentity
): boolean {
  return (
    a.sourceContentDigest === b.sourceContentDigest &&
    a.domainPolicyId === b.domainPolicyId &&
    a.domainPolicyVersion === b.domainPolicyVersion &&
    a.domainPolicyLanguage === b.domainPolicyLanguage &&
    a.qualityTier === b.qualityTier
  )
}

/**
 * Timing inputs of the due check, derived from row timestamps because no
 * change history is stored.
 *
 * The quiet period runs from the latest resource `updatedAt` or settings
 * change. Ingestion writes also move `updatedAt`, so the quiet period errs
 * towards waiting longer.
 *
 * The maximum deferral runs from `pendingSinceAt`, which is built only from
 * timestamps that later writes never move: when the serving version of a new
 * or changed source was first requested, when a snapshot source was deleted,
 * and when the settings last changed. It is never earlier than the published
 * build or than the moment the KB became eligible, so material that predates
 * the opt-in or the subject choice still waits out a quiet period. Only when
 * no such timestamp identifies the change (a source reclassified or already
 * hard-deleted) does it fall back to the latest change.
 *
 * Failures count only for builds of exactly the desired preparation, so a
 * subject, language or source change always gets a fresh attempt.
 */
export function deriveKBGraphPreparationTiming(
  candidate: KBGraphPreparationCandidate,
  {
    reason,
    desired,
    config,
    now,
  }: {
    reason: KBGraphPreparationPendingReason
    desired: KBGraphPreparationIdentity
    config: KBGraphPreparationScheduleConfig
    now: Date
  }
): { timing: KBGraphPreparationTiming; consecutiveFailures: number } {
  const lastChangeAt = latest([
    candidate.lastResourceChangeAt,
    candidate.graphSettingsChangedAt,
  ])
  const pendingSinceAt = deriveKBGraphPreparationPendingSince(
    candidate,
    reason,
    now
  )

  let consecutiveFailures = 0
  let lastFailedAt: Date | null = null
  let newestAttempt = true
  for (const build of candidate.recentBuilds) {
    if (!sameKBGraphPreparationIdentity(build, desired)) continue
    if (build.status !== DB.KBGraphBuildStatus.FAILED) break
    if (newestAttempt) lastFailedAt = build.finishedAt ?? build.updatedAt
    newestAttempt = false
    consecutiveFailures += 1
  }
  const backoffMs = Math.min(
    KB_GRAPH_PREPARATION_MAX_BACKOFF_MS,
    config.failureBackoffMs * 2 ** Math.max(0, consecutiveFailures - 1)
  )

  return {
    timing: {
      now,
      lastChangeAt,
      quietPeriodMs: config.quietPeriodMs,
      pendingSinceAt,
      maxDeferralMs: config.maxDeferralMs,
      lastFailedAt,
      backoffMs,
    },
    consecutiveFailures,
  }
}

/**
 * When the currently unmet preparation first became pending, as described for
 * `deriveKBGraphPreparationTiming`. It needs no schedule policy, so generation
 * readiness reports the same pending age as the sweep without depending on the
 * worker's configuration.
 */
export function deriveKBGraphPreparationPendingSince(
  candidate: KBGraphPreparationCandidate,
  reason: KBGraphPreparationPendingReason,
  now: Date
): Date {
  const lastChangeAt = latest([
    candidate.lastResourceChangeAt,
    candidate.graphSettingsChangedAt,
  ])

  const published = candidate.published
  const changeAnchors: Date[] = []
  if (!published) {
    for (const resource of candidate.servingResources) {
      changeAnchors.push(
        resource.servingVersionRequestedAt ?? resource.createdAt
      )
    }
  } else {
    const snapshot = new Map(
      published.sources.map((source) => [
        source.resourceId,
        source.contentSha256,
      ])
    )
    const servingIds = new Set<string>()
    for (const resource of candidate.servingResources) {
      servingIds.add(resource.id)
      const snapshotSha256 = snapshot.get(resource.id)
      if (snapshotSha256 === resource.activeContentSha256) continue
      // A source new to the graph cannot have been requested before it was
      // created; a replaced one has no immutable timestamp without its attempt.
      const requestedAt =
        resource.servingVersionRequestedAt ??
        (snapshotSha256 === undefined ? resource.createdAt : null)
      if (requestedAt) changeAnchors.push(requestedAt)
    }
    for (const source of candidate.deletedPublishedSources) {
      if (!servingIds.has(source.resourceId)) {
        changeAnchors.push(source.deletedAt)
      }
    }
    if (reason === 'SETTINGS_CHANGED') {
      changeAnchors.push(candidate.graphSettingsChangedAt)
    }
  }
  const notBefore = latest([
    candidate.graphSettingsChangedAt,
    published?.createdAt ?? null,
  ])
  return latest([earliest(changeAnchors) ?? lastChangeAt, notBefore]) ?? now
}

/**
 * Decides whether one KB is due for scheduled preparation, or why not. The
 * classification is read without locks and may be stale. The system trigger
 * rechecks the owner's entitlement and rollout flags, then under the KB lock
 * the opt-in, that the stored subject and language resolve, the build slot
 * and a pending dispatch review, the serving course content, and whether the
 * published graph still differs from the desired preparation. It does not
 * recheck the quiet period, backoff, failure limit or quota headroom; the
 * quota reservation and the slot compare-and-swap still bound what it spends.
 */
export function classifyKBGraphPreparationCandidate(
  candidate: KBGraphPreparationCandidate,
  owner: KBGraphSystemOwnerAdmission,
  config: KBGraphPreparationScheduleConfig,
  now: Date
): KBGraphPreparationClassification {
  const skip = (
    reason: KBGraphPreparationSkipReason,
    pendingSinceAt: Date | null = null
  ) => ({ kind: 'skip' as const, reason, pendingSinceAt })

  if (owner.capability !== 'enabled' || !owner.graphBuildsAdmitted) {
    return skip('OWNER_NOT_ADMITTED')
  }
  const resolution = owner.domainCapabilityEnabled
    ? resolveKBGraphDomainSelection(
        {
          domainPolicyId: candidate.domainPolicyId,
          domainPolicyVersion: candidate.domainPolicyVersion,
          language: candidate.domainPolicyLanguage,
        },
        { catalog: getDefaultKBGraphDomainCatalog(), capabilityEnabled: true }
      )
    : null
  if (!resolution?.ok || !resolution.selection) {
    return skip('UNSUPPORTED_SETTINGS')
  }

  const desired: KBGraphPreparationIdentity = {
    domainPolicyId: resolution.selection.domainPolicyId,
    domainPolicyVersion: resolution.selection.domainPolicyVersion,
    domainPolicyLanguage: resolution.selection.language,
    qualityTier: KB_GRAPH_PREPARATION_QUALITY_TIER,
    sourceContentDigest: hashKBContentDigestEntries(
      candidate.servingResources.map((resource) => ({
        resourceId: resource.id,
        contentSha256: resource.activeContentSha256,
      }))
    ),
  }
  const pending = getKBGraphPreparationStatus({
    desired,
    published: candidate.published,
  })
  if (!pending.pending || !pending.reason) {
    return skip('CURRENT')
  }

  const { timing, consecutiveFailures } = deriveKBGraphPreparationTiming(
    candidate,
    {
      reason: pending.reason,
      desired,
      config,
      now,
    }
  )
  const pendingSinceAt = timing.pendingSinceAt ?? now
  if (
    candidate.activeBuild?.status === DB.KBGraphBuildStatus.QUEUED ||
    candidate.activeBuild?.status === DB.KBGraphBuildStatus.PROCESSING
  ) {
    return skip('ALREADY_ACTIVE', pendingSinceAt)
  }
  if (candidate.activeBuild?.errorCode === 'KB_GRAPH_DISPATCH_AMBIGUOUS') {
    return skip('NEEDS_REVIEW', pendingSinceAt)
  }
  if (consecutiveFailures >= config.maxConsecutiveFailures) {
    return skip('FAILURE_LIMIT', pendingSinceAt)
  }

  const status = getKBGraphPreparationStatus({
    desired,
    published: candidate.published,
    timing,
  })
  if (!status.due) {
    const inBackoff =
      timing.lastFailedAt !== null &&
      timing.lastFailedAt.getTime() + timing.backoffMs > now.getTime()
    return skip(inBackoff ? 'BACKOFF' : 'QUIET_PERIOD', pendingSinceAt)
  }
  return { kind: 'due', pendingSinceAt }
}

export interface KBGraphPreparationDueEntry {
  kbId: string
  ownerId: string
  pendingSinceAt: Date
}

/**
 * Admission order for due KBs: owners take turns, each owner's oldest unmet
 * preparation first, and owners ordered by their oldest one. An owner is
 * skipped once another Standard build would cut into the interactive
 * headroom of their semester quota. At most `capacity` KBs are admitted.
 */
export function planKBGraphPreparationAdmissions(
  due: KBGraphPreparationDueEntry[],
  {
    capacity,
    estimateMinorUnits,
    headroomMinorUnits,
    remainingQuotaMinorUnits,
  }: {
    capacity: number
    estimateMinorUnits: number
    headroomMinorUnits: number
    remainingQuotaMinorUnits: (ownerId: string) => number
  }
): {
  admit: KBGraphPreparationDueEntry[]
  skipped: Array<{
    entry: KBGraphPreparationDueEntry
    reason: 'QUOTA_HEADROOM' | 'CAPACITY'
  }>
} {
  const byOwner = new Map<string, KBGraphPreparationDueEntry[]>()
  for (const entry of due) {
    const entries = byOwner.get(entry.ownerId) ?? []
    entries.push(entry)
    byOwner.set(entry.ownerId, entries)
  }
  const compare = (
    a: KBGraphPreparationDueEntry,
    b: KBGraphPreparationDueEntry
  ) =>
    a.pendingSinceAt.getTime() - b.pendingSinceAt.getTime() ||
    a.kbId.localeCompare(b.kbId)
  const queues = [...byOwner.values()]
    .map((entries) => entries.sort(compare))
    .sort((a, b) => compare(a[0]!, b[0]!))

  const admit: KBGraphPreparationDueEntry[] = []
  const skipped: Array<{
    entry: KBGraphPreparationDueEntry
    reason: 'QUOTA_HEADROOM' | 'CAPACITY'
  }> = []
  const admittedPerOwner = new Map<string, number>()
  const rounds = Math.max(0, ...queues.map((entries) => entries.length))
  for (let round = 0; round < rounds; round += 1) {
    for (const entries of queues) {
      const entry = entries[round]
      if (!entry) continue
      const admittedForOwner = admittedPerOwner.get(entry.ownerId) ?? 0
      const remainingAfter =
        remainingQuotaMinorUnits(entry.ownerId) -
        estimateMinorUnits * (admittedForOwner + 1)
      if (remainingAfter < headroomMinorUnits) {
        skipped.push({ entry, reason: 'QUOTA_HEADROOM' })
      } else if (admit.length >= capacity) {
        skipped.push({ entry, reason: 'CAPACITY' })
      } else {
        admit.push(entry)
        admittedPerOwner.set(entry.ownerId, admittedForOwner + 1)
      }
    }
  }
  return { admit, skipped }
}

export type KBGraphPreparationLogger = {
  info: (
    message: string,
    metadata?: Record<string, string | number | boolean | null>
  ) => unknown
  warn?: (
    message: string,
    metadata?: Record<string, string | number | boolean | null>
  ) => unknown
}

export interface KBGraphPreparationSweepSummary {
  status: 'COMPLETED' | 'CONFIGURATION_INVALID' | 'COST_CONFIGURATION_MISSING'
  scanned: number
  due: number
  admitted: number
  activeBuilds: number
  capacity: number
  /** More candidates existed than the bounded pages cover. */
  truncated: boolean
  oldestUnmetAgeMinutes: number | null
  skipped: Record<KBGraphPreparationSkipReason, number>
}

export type KBGraphPreparationSweepDeps = KBGraphBuildServiceContext & {
  logger?: KBGraphPreparationLogger
  env?: NodeJS.ProcessEnv
  now?: () => Date
  startBuild?: typeof startKbKnowledgeGraphBuild
}

const SERVING_COURSE_CONTENT_WHERE = {
  deletedAt: null,
  activeContentSha256: { not: null },
  materialType: DB.KBResourceMaterialType.COURSE_CONTENT,
} satisfies DB.Prisma.KBResourceWhereInput

const ACTIVE_BUILD_STATUSES = [
  DB.KBGraphBuildStatus.QUEUED,
  DB.KBGraphBuildStatus.PROCESSING,
]

function emptySkipCounts(): Record<KBGraphPreparationSkipReason, number> {
  return {
    CURRENT: 0,
    QUIET_PERIOD: 0,
    BACKOFF: 0,
    FAILURE_LIMIT: 0,
    QUOTA_HEADROOM: 0,
    QUOTA: 0,
    OWNER_NOT_ADMITTED: 0,
    UNSUPPORTED_SETTINGS: 0,
    ALREADY_ACTIVE: 0,
    NEEDS_REVIEW: 0,
    CAPACITY: 0,
    ERROR: 0,
  }
}

function skipReasonForStartError(error: unknown): KBGraphPreparationSkipReason {
  const code =
    error instanceof GraphQLError ? error.extensions?.code : undefined
  switch (code) {
    case 'AI_BETA_ACCESS_REQUIRED':
    case 'AI_FEATURE_TEMPORARILY_UNAVAILABLE':
    case 'KB_GRAPH_DISABLED':
      return 'OWNER_NOT_ADMITTED'
    case 'KB_GRAPH_QUOTA_EXCEEDED':
    case 'KB_GRAPH_QUOTA_CONFIGURATION_CHANGED':
      return 'QUOTA'
    case 'KB_GRAPH_DISPATCH_AMBIGUOUS':
      return 'NEEDS_REVIEW'
    default:
      return 'ERROR'
  }
}

const SCHEDULED_CANDIDATE_WHERE = {
  deletedAt: null,
  // The per-KB opt-in is the operator hold for scheduled preparation.
  knowledgeGraphEnabled: true,
  domainPolicyId: { not: null },
  domainPolicyVersion: { not: null },
  domainPolicyLanguage: { not: null },
  resources: { some: SERVING_COURSE_CONTENT_WHERE },
} satisfies DB.Prisma.KBWhereInput

async function loadCandidatePage(
  prisma: KBGraphBuildServiceContext['prisma'],
  cursor: string | null,
  where: DB.Prisma.KBWhereInput = SCHEDULED_CANDIDATE_WHERE
): Promise<KBGraphPreparationCandidate[]> {
  const kbs = await prisma.kB.findMany({
    where: cursor ? { AND: [where, { id: { gt: cursor } }] } : where,
    select: {
      id: true,
      ownerId: true,
      graphSettingsChangedAt: true,
      activeGraphBuildId: true,
      publishedGraphBuildId: true,
      domainPolicyId: true,
      domainPolicyVersion: true,
      domainPolicyLanguage: true,
      resources: {
        where: SERVING_COURSE_CONTENT_WHERE,
        select: {
          id: true,
          activeContentSha256: true,
          activeResourceVersion: true,
          createdAt: true,
        },
        orderBy: { id: 'asc' },
      },
      // A build is only created while the slot is free, so a slot holder is
      // always the newest build and appears here.
      graphBuilds: {
        select: {
          id: true,
          status: true,
          errorCode: true,
          qualityTier: true,
          domainPolicyId: true,
          domainPolicyVersion: true,
          domainPolicyLanguage: true,
          sourceContentDigest: true,
          finishedAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: KB_GRAPH_PREPARATION_RECENT_BUILDS,
      },
    },
    orderBy: { id: 'asc' },
    take: KB_GRAPH_PREPARATION_PAGE_SIZE,
  })
  if (kbs.length === 0) return []

  const kbIds = kbs.map((kb) => kb.id)
  const publishedIds = kbs.flatMap((kb) =>
    kb.publishedGraphBuildId ? [kb.publishedGraphBuildId] : []
  )
  const publishedBuilds = await prisma.kBGraphBuild.findMany({
    where: {
      id: { in: publishedIds },
      status: DB.KBGraphBuildStatus.SUCCEEDED,
    },
    select: {
      id: true,
      kbId: true,
      createdAt: true,
      qualityTier: true,
      domainPolicyId: true,
      domainPolicyVersion: true,
      domainPolicyLanguage: true,
      sourceContentDigest: true,
    },
  })
  const resourceChanges = await prisma.kBResource.groupBy({
    by: ['kbId'],
    where: { kbId: { in: kbIds } },
    _max: { updatedAt: true },
  })
  const publishedById = new Map(
    publishedBuilds
      .filter((build) =>
        kbs.some(
          (kb) => kb.id === build.kbId && kb.publishedGraphBuildId === build.id
        )
      )
      .map((build) => [build.id, build])
  )
  const lastChangeByKb = new Map(
    resourceChanges.map((row) => [row.kbId, row._max.updatedAt ?? null])
  )

  const snapshotRows = await prisma.kBGraphBuildSource.findMany({
    where: { buildId: { in: [...publishedById.keys()] } },
    select: { buildId: true, resourceId: true, contentSha256: true },
  })
  const snapshotByBuild = new Map<
    string,
    Array<{ resourceId: string; contentSha256: string }>
  >()
  for (const row of snapshotRows) {
    const sources = snapshotByBuild.get(row.buildId) ?? []
    sources.push({
      resourceId: row.resourceId,
      contentSha256: row.contentSha256,
    })
    snapshotByBuild.set(row.buildId, sources)
  }

  // Only sources whose serving content is not in the published snapshot need
  // an immutable change timestamp.
  const changedVersions: Array<{
    resourceId: string
    resourceVersion: number
  }> = []
  const deletedCandidateIds: string[] = []
  for (const kb of kbs) {
    const snapshot = kb.publishedGraphBuildId
      ? snapshotByBuild.get(kb.publishedGraphBuildId)
      : undefined
    const snapshotSha256 = new Map(
      (snapshot ?? []).map((source) => [
        source.resourceId,
        source.contentSha256,
      ])
    )
    for (const resource of kb.resources) {
      if (
        resource.activeResourceVersion !== null &&
        snapshotSha256.get(resource.id) !== resource.activeContentSha256
      ) {
        changedVersions.push({
          resourceId: resource.id,
          resourceVersion: resource.activeResourceVersion,
        })
      }
    }
    const servingIds = new Set(kb.resources.map((resource) => resource.id))
    for (const source of snapshot ?? []) {
      if (!servingIds.has(source.resourceId)) {
        deletedCandidateIds.push(source.resourceId)
      }
    }
  }
  const attemptRows =
    changedVersions.length > 0
      ? await prisma.kBIngestionRun.groupBy({
          by: ['resourceId', 'resourceVersion', 'contentSha256'],
          where: {
            operation: DB.KBIngestionOperation.UPSERT,
            OR: changedVersions,
          },
          _min: { createdAt: true },
        })
      : []
  const deletedSources =
    deletedCandidateIds.length > 0
      ? await prisma.kBResource.findMany({
          where: {
            kbId: { in: kbIds },
            id: { in: deletedCandidateIds },
            deletedAt: { not: null },
          },
          select: { id: true, kbId: true, deletedAt: true },
        })
      : []

  const attemptsByVersion = new Map<string, typeof attemptRows>()
  for (const row of attemptRows) {
    const key = `${row.resourceId}:${row.resourceVersion}`
    attemptsByVersion.set(key, [...(attemptsByVersion.get(key) ?? []), row])
  }
  const servingVersionRequestedAt = (resource: {
    id: string
    activeResourceVersion: number | null
    activeContentSha256: string | null
  }): Date | null => {
    const attempts =
      attemptsByVersion.get(
        `${resource.id}:${resource.activeResourceVersion}`
      ) ?? []
    const matching = attempts.filter(
      (row) => row.contentSha256 === resource.activeContentSha256
    )
    return earliest(
      (matching.length > 0 ? matching : attempts).flatMap((row) =>
        row._min.createdAt ? [row._min.createdAt] : []
      )
    )
  }

  return kbs.map((kb) => {
    const published = kb.publishedGraphBuildId
      ? publishedById.get(kb.publishedGraphBuildId)
      : undefined
    const activeBuild = kb.activeGraphBuildId
      ? kb.graphBuilds.find((build) => build.id === kb.activeGraphBuildId)
      : undefined
    return {
      kbId: kb.id,
      ownerId: kb.ownerId,
      graphSettingsChangedAt: kb.graphSettingsChangedAt,
      domainPolicyId: kb.domainPolicyId,
      domainPolicyVersion: kb.domainPolicyVersion,
      domainPolicyLanguage: kb.domainPolicyLanguage,
      servingResources: kb.resources.flatMap((resource) =>
        resource.activeContentSha256 === null
          ? []
          : [
              {
                id: resource.id,
                activeContentSha256: resource.activeContentSha256,
                createdAt: resource.createdAt,
                servingVersionRequestedAt: servingVersionRequestedAt(resource),
              },
            ]
      ),
      lastResourceChangeAt: lastChangeByKb.get(kb.id) ?? null,
      // An unknown slot holder is treated as active so it is never raced.
      activeBuild: kb.activeGraphBuildId
        ? (activeBuild ?? {
            status: DB.KBGraphBuildStatus.QUEUED,
            errorCode: null,
          })
        : null,
      published: published
        ? {
            buildId: published.id,
            createdAt: published.createdAt,
            qualityTier: published.qualityTier,
            domainPolicyId: published.domainPolicyId,
            domainPolicyVersion: published.domainPolicyVersion,
            domainPolicyLanguage: published.domainPolicyLanguage,
            sourceContentDigest: published.sourceContentDigest,
            sources: snapshotByBuild.get(published.id) ?? [],
          }
        : null,
      deletedPublishedSources: published
        ? deletedSources.flatMap((source) =>
            source.kbId === kb.id && source.deletedAt
              ? [{ resourceId: source.id, deletedAt: source.deletedAt }]
              : []
          )
        : [],
      recentBuilds: kb.graphBuilds,
    }
  })
}

/**
 * Preparation candidates of every KB matching `where`, whether or not
 * scheduled preparation would consider them, read in the sweep's pages. Each
 * page costs a fixed number of queries, so readiness for a list of KBs never
 * issues per-KB reads.
 */
export async function loadKBGraphPreparationCandidates(
  prisma: KBGraphBuildServiceContext['prisma'],
  where: DB.Prisma.KBWhereInput
): Promise<KBGraphPreparationCandidate[]> {
  const candidates: KBGraphPreparationCandidate[] = []
  let cursor: string | null = null
  for (;;) {
    const page = await loadCandidatePage(prisma, cursor, where)
    candidates.push(...page)
    if (page.length < KB_GRAPH_PREPARATION_PAGE_SIZE) return candidates
    cursor = page[page.length - 1]!.kbId
  }
}

/**
 * One pass of scheduled graph preparation. Candidates are read in bounded
 * pages without a transaction; each admission then goes through the system
 * trigger, whose KB lock and slot compare-and-swap keep one active build per
 * KB even if two sweeps overlap. The trigger dispatches after its short
 * transaction commits, so no provider call runs inside one.
 */
export async function sweepKbGraphPreparation(
  deps: KBGraphPreparationSweepDeps
): Promise<KBGraphPreparationSweepSummary> {
  const env = deps.env ?? process.env
  const now = deps.now?.() ?? new Date()
  const startBuild = deps.startBuild ?? startKbKnowledgeGraphBuild
  const skipped = emptySkipCounts()
  const summary: KBGraphPreparationSweepSummary = {
    status: 'COMPLETED',
    scanned: 0,
    due: 0,
    admitted: 0,
    activeBuilds: 0,
    capacity: 0,
    truncated: false,
    oldestUnmetAgeMinutes: null,
    skipped,
  }
  const finish = () => {
    deps.logger?.info('KB graph preparation sweep finished', {
      status: summary.status,
      scanned: summary.scanned,
      due: summary.due,
      admitted: summary.admitted,
      activeBuilds: summary.activeBuilds,
      capacity: summary.capacity,
      truncated: summary.truncated,
      oldestUnmetAgeMinutes: summary.oldestUnmetAgeMinutes,
      ...Object.fromEntries(
        Object.entries(skipped).map(([reason, count]) => [
          `skipped${reason}`,
          count,
        ])
      ),
    })
    return summary
  }

  let config: KBGraphPreparationScheduleConfig
  try {
    config = getKBGraphPreparationScheduleConfig(env)
  } catch (error) {
    deps.logger?.warn?.('KB graph preparation schedule is misconfigured', {
      error: error instanceof Error ? error.message : 'unknown',
    })
    summary.status = 'CONFIGURATION_INVALID'
    return finish()
  }
  let costConfiguration: ReturnType<typeof requireKBGraphCostConfiguration>
  try {
    costConfiguration = requireKBGraphCostConfiguration(env, now)
  } catch {
    summary.status = 'COST_CONFIGURATION_MISSING'
    return finish()
  }
  const estimateMinorUnits = getKBGraphEstimate(
    KB_GRAPH_PREPARATION_QUALITY_TIER,
    costConfiguration
  )
  if (estimateMinorUnits === null) {
    summary.status = 'COST_CONFIGURATION_MISSING'
    return finish()
  }

  summary.activeBuilds = await deps.prisma.kBGraphBuild.count({
    where: { status: { in: ACTIVE_BUILD_STATUSES } },
  })
  summary.capacity = Math.max(0, config.concurrencyCap - summary.activeBuilds)

  const owners = new Map<string, KBGraphSystemOwnerAdmission>()
  const due: KBGraphPreparationDueEntry[] = []
  let oldestPendingSinceAt: Date | null = null
  let cursor: string | null = null
  for (let page = 0; page < KB_GRAPH_PREPARATION_MAX_PAGES; page += 1) {
    const candidates = await loadCandidatePage(deps.prisma, cursor)
    if (candidates.length === 0) break
    cursor = candidates[candidates.length - 1]!.kbId

    const unknownOwnerIds = [
      ...new Set(candidates.map((candidate) => candidate.ownerId)),
    ].filter((ownerId) => !owners.has(ownerId))
    if (unknownOwnerIds.length > 0) {
      const users = await deps.prisma.user.findMany({
        where: { id: { in: unknownOwnerIds } },
        select: KB_GRAPH_SYSTEM_OWNER_SELECT,
      })
      const usersById = new Map(users.map((user) => [user.id, user]))
      for (const ownerId of unknownOwnerIds) {
        owners.set(
          ownerId,
          evaluateKBGraphSystemOwner(
            deps.featureFlags,
            usersById.get(ownerId) ?? null
          )
        )
      }
    }

    for (const candidate of candidates) {
      summary.scanned += 1
      const classification = classifyKBGraphPreparationCandidate(
        candidate,
        owners.get(candidate.ownerId)!,
        config,
        now
      )
      if (
        classification.pendingSinceAt &&
        (oldestPendingSinceAt === null ||
          classification.pendingSinceAt < oldestPendingSinceAt)
      ) {
        oldestPendingSinceAt = classification.pendingSinceAt
      }
      if (classification.kind === 'due') {
        due.push({
          kbId: candidate.kbId,
          ownerId: candidate.ownerId,
          pendingSinceAt: classification.pendingSinceAt,
        })
      } else {
        skipped[classification.reason] += 1
      }
    }
    if (candidates.length < KB_GRAPH_PREPARATION_PAGE_SIZE) break
    if (page === KB_GRAPH_PREPARATION_MAX_PAGES - 1) summary.truncated = true
  }
  summary.due = due.length
  summary.oldestUnmetAgeMinutes =
    oldestPendingSinceAt === null
      ? null
      : Math.floor((now.getTime() - oldestPendingSinceAt.getTime()) / MINUTE_MS)

  const dueOwnerIds = [...new Set(due.map((entry) => entry.ownerId))]
  const quotas =
    dueOwnerIds.length > 0
      ? await deps.prisma.kBGraphQuota.findMany({
          where: {
            ownerId: { in: dueOwnerIds },
            semesterKey: costConfiguration.semesterKey,
          },
          select: {
            ownerId: true,
            limitMinorUnits: true,
            reservedMinorUnits: true,
            settledMinorUnits: true,
          },
        })
      : []
  const remainingByOwner = new Map(
    quotas.map((quota) => [
      quota.ownerId,
      quota.limitMinorUnits -
        quota.reservedMinorUnits -
        quota.settledMinorUnits,
    ])
  )
  const plan = planKBGraphPreparationAdmissions(due, {
    capacity: summary.capacity,
    estimateMinorUnits,
    headroomMinorUnits: config.headroomMinorUnits,
    remainingQuotaMinorUnits: (ownerId) =>
      remainingByOwner.get(ownerId) ??
      costConfiguration.semesterQuotaMinorUnits,
  })
  for (const { reason } of plan.skipped) skipped[reason] += 1

  for (const entry of plan.admit) {
    try {
      const result = await startBuild(
        { kbId: entry.kbId },
        { kind: 'system', ownerId: entry.ownerId },
        deps
      )
      if (result.outcome === 'QUEUED') {
        summary.admitted += 1
        deps.logger?.info('KB graph preparation admitted', {
          kbId: entry.kbId,
          buildId: result.build?.id ?? null,
          pendingMinutes: Math.floor(
            (now.getTime() - entry.pendingSinceAt.getTime()) / MINUTE_MS
          ),
        })
      } else {
        skipped[result.outcome === 'NOT_DUE' ? 'CURRENT' : result.outcome] += 1
      }
    } catch (error) {
      const reason = skipReasonForStartError(error)
      skipped[reason] += 1
      deps.logger?.warn?.('KB graph preparation start refused', {
        kbId: entry.kbId,
        reason,
        code:
          error instanceof GraphQLError
            ? String(error.extensions?.code ?? 'UNKNOWN')
            : 'UNEXPECTED',
      })
    }
  }

  return finish()
}

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
  /** Repeated failures on unchanged sources; operations must look first. */
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
  kbUpdatedAt: Date
  domainPolicyId: string | null
  domainPolicyVersion: number | null
  domainPolicyLanguage: string | null
  /** Serving course-content resources in id order: what a build snapshots. */
  servingResources: Array<{
    id: string
    activeContentSha256: string
    createdAt: Date
    updatedAt: Date
  }>
  /** Latest update of any resource of the KB, deleted or administrative ones included. */
  lastResourceChangeAt: Date | null
  activeBuild: {
    status: DB.KBGraphBuildStatus
    errorCode: string | null
  } | null
  published: (KBGraphPreparationIdentity & { createdAt: Date }) | null
  /** Newest builds first, at least `maxConsecutiveFailures` of them when present. */
  recentBuilds: Array<{
    status: DB.KBGraphBuildStatus
    sourceContentDigest: string
    finishedAt: Date | null
    updatedAt: Date
  }>
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

/**
 * Timing inputs of the due check, derived from row timestamps because no
 * change history is stored. Resource `updatedAt` stands in for serving
 * changes and the KB's `updatedAt` for settings changes; both also move for
 * unrelated edits, so the quiet period errs towards waiting longer, and the
 * age bound still guarantees progress.
 */
export function deriveKBGraphPreparationTiming(
  candidate: KBGraphPreparationCandidate,
  {
    reason,
    desiredSourceContentDigest,
    config,
    now,
  }: {
    reason: KBGraphPreparationPendingReason
    desiredSourceContentDigest: string
    config: KBGraphPreparationScheduleConfig
    now: Date
  }
): { timing: KBGraphPreparationTiming; consecutiveFailures: number } {
  const settingsChangeAt =
    reason === 'SETTINGS_CHANGED' ? candidate.kbUpdatedAt : null
  const lastChangeAt = latest([
    candidate.lastResourceChangeAt,
    settingsChangeAt,
  ])

  let pendingSinceAt: Date | null
  if (!candidate.published) {
    pendingSinceAt = earliest(
      candidate.servingResources.map((resource) => resource.createdAt)
    )
  } else {
    const snapshotAt = candidate.published.createdAt
    pendingSinceAt = earliest(
      [
        ...candidate.servingResources.map((resource) => resource.updatedAt),
        ...(settingsChangeAt ? [settingsChangeAt] : []),
      ].filter((date) => date > snapshotAt)
    )
  }
  pendingSinceAt ??= lastChangeAt ?? now

  let consecutiveFailures = 0
  for (const build of candidate.recentBuilds) {
    if (
      build.status !== DB.KBGraphBuildStatus.FAILED ||
      build.sourceContentDigest !== desiredSourceContentDigest
    ) {
      break
    }
    consecutiveFailures += 1
  }
  const newestBuild = candidate.recentBuilds[0]
  const lastFailedAt =
    newestBuild?.status === DB.KBGraphBuildStatus.FAILED
      ? (newestBuild.finishedAt ?? newestBuild.updatedAt)
      : null
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
 * Decides whether one KB is due for scheduled preparation, or why not. The
 * system trigger repeats the admission and due checks under the KB lock, so
 * a stale classification can never start a second build or spend on a
 * current graph.
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
      desiredSourceContentDigest: desired.sourceContentDigest,
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

async function loadCandidatePage(
  prisma: KBGraphBuildServiceContext['prisma'],
  cursor: string | null,
  config: KBGraphPreparationScheduleConfig
): Promise<KBGraphPreparationCandidate[]> {
  const kbs = await prisma.kB.findMany({
    where: {
      deletedAt: null,
      // The per-KB opt-in is the operator hold for scheduled preparation.
      knowledgeGraphEnabled: true,
      domainPolicyId: { not: null },
      domainPolicyVersion: { not: null },
      domainPolicyLanguage: { not: null },
      resources: { some: SERVING_COURSE_CONTENT_WHERE },
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    select: {
      id: true,
      ownerId: true,
      updatedAt: true,
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
          createdAt: true,
          updatedAt: true,
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
          sourceContentDigest: true,
          finishedAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: config.maxConsecutiveFailures,
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
    publishedBuilds.map((build) => [build.id, build])
  )
  const lastChangeByKb = new Map(
    resourceChanges.map((row) => [row.kbId, row._max.updatedAt ?? null])
  )

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
      kbUpdatedAt: kb.updatedAt,
      domainPolicyId: kb.domainPolicyId,
      domainPolicyVersion: kb.domainPolicyVersion,
      domainPolicyLanguage: kb.domainPolicyLanguage,
      servingResources: kb.resources.flatMap((resource) =>
        resource.activeContentSha256 === null
          ? []
          : [{ ...resource, activeContentSha256: resource.activeContentSha256 }]
      ),
      lastResourceChangeAt: lastChangeByKb.get(kb.id) ?? null,
      // An unknown slot holder is treated as active so it is never raced.
      activeBuild: kb.activeGraphBuildId
        ? (activeBuild ?? {
            status: DB.KBGraphBuildStatus.QUEUED,
            errorCode: null,
          })
        : null,
      published:
        published && published.kbId === kb.id
          ? {
              createdAt: published.createdAt,
              qualityTier: published.qualityTier,
              domainPolicyId: published.domainPolicyId,
              domainPolicyVersion: published.domainPolicyVersion,
              domainPolicyLanguage: published.domainPolicyLanguage,
              sourceContentDigest: published.sourceContentDigest,
            }
          : null,
      recentBuilds: kb.graphBuilds,
    }
  })
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
    const candidates = await loadCandidatePage(deps.prisma, cursor, config)
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
        skipped[
          result.outcome === 'ALREADY_ACTIVE' ? 'ALREADY_ACTIVE' : 'CURRENT'
        ] += 1
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

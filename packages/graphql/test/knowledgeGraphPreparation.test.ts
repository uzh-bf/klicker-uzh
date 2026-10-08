import {
  getDefaultKBGraphDomainCatalog,
  hashKBContentDigestEntries,
  KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV,
} from '@klicker-uzh/knowledge-graph'
import {
  KBGraphBuildStatus,
  KBGraphQualityTier,
} from '@klicker-uzh/prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  KBGraphBuildServiceContext,
  KBGraphBuildStart,
  KBGraphSystemOwnerAdmission,
} from '../src/services/knowledge.js'
import {
  classifyKBGraphPreparationCandidate,
  getKBGraphPreparationScheduleConfig,
  type KBGraphPreparationCandidate,
  type KBGraphPreparationDueEntry,
  planKBGraphPreparationAdmissions,
  sweepKbGraphPreparation,
} from '../src/services/knowledgeGraphPreparation.js'

const MINUTE = 60_000
const now = new Date('2026-09-24T12:00:00.000Z')
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * MINUTE)
const config = getKBGraphPreparationScheduleConfig({})
const admittedOwner: KBGraphSystemOwnerAdmission = {
  capability: 'enabled',
  graphBuildsAdmitted: true,
  domainCapabilityEnabled: true,
}
const domain = {
  domainPolicyId: 'mathematics',
  domainPolicyVersion: 1,
  domainPolicyLanguage: 'German',
}
const resource = {
  id: '11111111-1111-4111-8111-111111111111',
  activeContentSha256: 'a'.repeat(64),
  createdAt: minutesAgo(3000),
  servingVersionRequestedAt: minutesAgo(3000),
}
const maxDeferralMinutes = config.maxDeferralMs / MINUTE
const currentDigest = hashKBContentDigestEntries([
  { resourceId: resource.id, contentSha256: resource.activeContentSha256 },
])

function candidate(
  overrides: Partial<KBGraphPreparationCandidate> = {}
): KBGraphPreparationCandidate {
  return {
    kbId: '22222222-2222-4222-8222-222222222222',
    ownerId: '33333333-3333-4333-8333-333333333333',
    graphSettingsChangedAt: minutesAgo(5000),
    ...domain,
    servingResources: [resource],
    lastResourceChangeAt: minutesAgo(3000),
    activeBuild: null,
    published: {
      ...domain,
      buildId: '44444444-4444-4444-8444-444444444444',
      qualityTier: KBGraphQualityTier.STANDARD,
      sourceContentDigest: 'older-digest',
      createdAt: minutesAgo(4000),
      sources: [],
    },
    deletedPublishedSources: [],
    recentBuilds: [],
    ...overrides,
  }
}

const failed = (
  minutes: number,
  identity: { sourceContentDigest?: string; domainPolicyLanguage?: string } = {}
) => ({
  ...domain,
  qualityTier: KBGraphQualityTier.STANDARD,
  sourceContentDigest: currentDigest,
  ...identity,
  status: KBGraphBuildStatus.FAILED,
  finishedAt: minutesAgo(minutes),
  updatedAt: minutesAgo(minutes),
})

describe('scheduled graph preparation due check', () => {
  const recentlyChanged = {
    servingResources: [
      { ...resource, servingVersionRequestedAt: minutesAgo(10) },
    ],
    lastResourceChangeAt: minutesAgo(10),
  }

  it.each([
    ['a changed source past the quiet period', {}, admittedOwner, 'due'],
    [
      'a published graph that already matches',
      {
        published: {
          ...domain,
          buildId: '44444444-4444-4444-8444-444444444444',
          qualityTier: KBGraphQualityTier.STANDARD,
          sourceContentDigest: currentDigest,
          createdAt: minutesAgo(4000),
          sources: [],
        },
      },
      admittedOwner,
      'CURRENT',
    ],
    [
      'a change inside the quiet period',
      recentlyChanged,
      admittedOwner,
      'QUIET_PERIOD',
    ],
    [
      'a source rewritten continuously since before the age bound',
      {
        servingResources: [
          {
            ...resource,
            servingVersionRequestedAt: minutesAgo(maxDeferralMinutes + 1),
          },
        ],
        lastResourceChangeAt: minutesAgo(5),
      },
      admittedOwner,
      'due',
    ],
    [
      'old material on a KB that just became eligible',
      {
        published: null,
        graphSettingsChangedAt: minutesAgo(10),
      },
      admittedOwner,
      'QUIET_PERIOD',
    ],
    [
      'old material once the new KB settings have settled',
      {
        published: null,
        graphSettingsChangedAt: minutesAgo(50),
      },
      admittedOwner,
      'due',
    ],
    [
      'a failure inside its backoff',
      { recentBuilds: [failed(30)] },
      admittedOwner,
      'BACKOFF',
    ],
    [
      'a second failure inside the doubled backoff',
      { recentBuilds: [failed(90), failed(400)] },
      admittedOwner,
      'BACKOFF',
    ],
    [
      'repeated failures of the unchanged preparation',
      { recentBuilds: [failed(3000), failed(4000), failed(5000)] },
      admittedOwner,
      'FAILURE_LIMIT',
    ],
    [
      'earlier failures on different sources',
      {
        recentBuilds: [
          failed(3000, { sourceContentDigest: 'other' }),
          failed(4000, { sourceContentDigest: 'other' }),
          failed(5000, { sourceContentDigest: 'other' }),
        ],
      },
      admittedOwner,
      'due',
    ],
    [
      'recent failures before a language change',
      {
        recentBuilds: [
          failed(30, { domainPolicyLanguage: 'English' }),
          failed(3000, { domainPolicyLanguage: 'English' }),
          failed(4000, { domainPolicyLanguage: 'English' }),
        ],
      },
      admittedOwner,
      'due',
    ],
    [
      'a build holding the slot',
      {
        activeBuild: { status: KBGraphBuildStatus.PROCESSING, errorCode: null },
      },
      admittedOwner,
      'ALREADY_ACTIVE',
    ],
    [
      'an ambiguous dispatch holding the slot',
      {
        activeBuild: {
          status: KBGraphBuildStatus.FAILED,
          errorCode: 'KB_GRAPH_DISPATCH_AMBIGUOUS',
        },
      },
      admittedOwner,
      'NEEDS_REVIEW',
    ],
    [
      'an owner outside the rollout',
      {},
      { ...admittedOwner, graphBuildsAdmitted: false },
      'OWNER_NOT_ADMITTED',
    ],
    [
      'an owner without AI entitlement',
      {},
      { ...admittedOwner, capability: 'disabled' as const },
      'OWNER_NOT_ADMITTED',
    ],
    [
      'an owner whose domain selection is closed',
      {},
      { ...admittedOwner, domainCapabilityEnabled: false },
      'UNSUPPORTED_SETTINGS',
    ],
    [
      'a subject the catalog does not describe',
      { domainPolicyId: 'unknown-subject' },
      admittedOwner,
      'UNSUPPORTED_SETTINGS',
    ],
  ])('classifies %s', (_, overrides, owner, expected) => {
    const result = classifyKBGraphPreparationCandidate(
      candidate(overrides),
      owner,
      config,
      now
    )

    expect(result.kind === 'due' ? 'due' : result.reason).toBe(expected)
  })

  it('refuses a quiet period outside 30 to 60 minutes', () => {
    expect(() =>
      getKBGraphPreparationScheduleConfig({
        KB_GRAPH_AUTO_PREPARATION_QUIET_PERIOD_MINUTES: '20',
      })
    ).toThrow()
    expect(
      getKBGraphPreparationScheduleConfig({
        KB_GRAPH_AUTO_PREPARATION_QUIET_PERIOD_MINUTES: '30',
      }).quietPeriodMs
    ).toBe(30 * MINUTE)
  })
})

describe('scheduled graph preparation admission order', () => {
  const entry = (
    kbId: string,
    ownerId: string,
    minutes: number
  ): KBGraphPreparationDueEntry => ({
    kbId,
    ownerId,
    pendingSinceAt: minutesAgo(minutes),
  })

  it('lets owners take turns, oldest unmet first, up to the cap', () => {
    const due = [
      entry('a-2', 'owner-a', 500),
      entry('a-1', 'owner-a', 900),
      entry('a-3', 'owner-a', 100),
      entry('b-1', 'owner-b', 300),
      entry('c-1', 'owner-c', 50),
    ]

    const plan = planKBGraphPreparationAdmissions(due, {
      capacity: 3,
      estimateMinorUnits: 100,
      headroomMinorUnits: 0,
      remainingQuotaMinorUnits: () => 1000,
    })

    expect(plan.admit.map(({ kbId }) => kbId)).toEqual(['a-1', 'b-1', 'c-1'])
    expect(plan.skipped).toEqual([
      { entry: expect.objectContaining({ kbId: 'a-2' }), reason: 'CAPACITY' },
      { entry: expect.objectContaining({ kbId: 'a-3' }), reason: 'CAPACITY' },
    ])
  })

  it('keeps the interactive headroom of each owner free', () => {
    const plan = planKBGraphPreparationAdmissions(
      [entry('a-1', 'owner-a', 900), entry('a-2', 'owner-a', 500)],
      {
        capacity: 5,
        estimateMinorUnits: 100,
        headroomMinorUnits: 100,
        remainingQuotaMinorUnits: () => 250,
      }
    )

    expect(plan.admit.map(({ kbId }) => kbId)).toEqual(['a-1'])
    expect(plan.skipped).toEqual([
      {
        entry: expect.objectContaining({ kbId: 'a-2' }),
        reason: 'QUOTA_HEADROOM',
      },
    ])
  })
})

describe('scheduled graph preparation sweep', () => {
  const costEnv = {
    KB_GRAPH_COST_CURRENCY: 'CHF',
    KB_GRAPH_STANDARD_ESTIMATE_MINOR_UNITS: '100',
    KB_GRAPH_HIGH_ESTIMATE_MINOR_UNITS: '200',
    KB_GRAPH_MAX_COST_MINOR_UNITS: '250',
    KB_GRAPH_SEMESTER_QUOTA_MINOR_UNITS: '1000',
    KB_GRAPH_COST_PRICING_VERSION: 'test-v1',
    KB_GRAPH_SEMESTER_KEY: '2026-H2',
  }
  const previousRevision = process.env[KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV]

  beforeEach(() => {
    process.env[KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV] =
      getDefaultKBGraphDomainCatalog().revision
  })

  afterEach(() => {
    if (previousRevision === undefined) {
      delete process.env[KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV]
    } else {
      process.env[KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV] = previousRevision
    }
  })

  function createDeps({
    activeBuilds = 0,
    servingVersionRequestedAt = minutesAgo(3000),
    lastResourceChangeAt = minutesAgo(3000),
  }: {
    activeBuilds?: number
    servingVersionRequestedAt?: Date
    lastResourceChangeAt?: Date
  } = {}) {
    const kb = candidate()
    const publishedBuildId = '55555555-5555-4555-8555-555555555555'
    const prisma = {
      kB: {
        findMany: vi.fn(async ({ where }: { where: { id?: unknown } }) =>
          where.id
            ? []
            : [
                {
                  id: kb.kbId,
                  ownerId: kb.ownerId,
                  graphSettingsChangedAt: kb.graphSettingsChangedAt,
                  activeGraphBuildId: null,
                  publishedGraphBuildId: publishedBuildId,
                  ...domain,
                  resources: [
                    {
                      id: resource.id,
                      activeContentSha256: resource.activeContentSha256,
                      activeResourceVersion: 2,
                      createdAt: resource.createdAt,
                    },
                  ],
                  graphBuilds: [],
                },
              ]
        ),
      },
      kBGraphBuild: {
        count: vi.fn(async () => activeBuilds),
        findMany: vi.fn(async () => [
          {
            id: publishedBuildId,
            kbId: kb.kbId,
            createdAt: minutesAgo(4000),
            qualityTier: KBGraphQualityTier.STANDARD,
            ...domain,
            sourceContentDigest: 'older-digest',
          },
        ]),
      },
      kBGraphBuildSource: {
        findMany: vi.fn(async () => [
          {
            buildId: publishedBuildId,
            resourceId: resource.id,
            contentSha256: 'b'.repeat(64),
          },
        ]),
      },
      // Ingestion rewrites the resource row on every step, so its latest
      // update can stay recent while the serving version is much older.
      kBResource: {
        groupBy: vi.fn(async () => [
          { kbId: kb.kbId, _max: { updatedAt: lastResourceChangeAt } },
        ]),
      },
      kBIngestionRun: {
        groupBy: vi.fn(async () => [
          {
            resourceId: resource.id,
            resourceVersion: 2,
            contentSha256: resource.activeContentSha256,
            _min: { createdAt: servingVersionRequestedAt },
          },
          {
            resourceId: resource.id,
            resourceVersion: 1,
            contentSha256: 'b'.repeat(64),
            _min: { createdAt: minutesAgo(6000) },
          },
        ]),
      },
      user: {
        findMany: vi.fn(async () => [
          {
            id: kb.ownerId,
            role: 'USER',
            catalystInstitutional: true,
            catalystIndividual: false,
            aiFeaturesEnabled: true,
            betaEnabled: true,
          },
        ]),
      },
      kBGraphQuota: { findMany: vi.fn(async () => []) },
    }
    return {
      kb,
      deps: {
        prisma,
        tasks: {},
        featureFlags: {
          isEnabled: () => true,
          getAiBetaDecision: () => 'enabled' as const,
          refresh: vi.fn(),
        },
      } as unknown as KBGraphBuildServiceContext,
    }
  }

  it('admits a KB once when two sweeps overlap', async () => {
    const { deps, kb } = createDeps()
    // Stands in for the KB lock and slot compare-and-swap of the trigger.
    const claimedSlots = new Set<string>()
    const startBuild = vi.fn(
      async ({ kbId }: { kbId: string }): Promise<KBGraphBuildStart> => {
        await Promise.resolve()
        const outcome = claimedSlots.has(kbId) ? 'ALREADY_ACTIVE' : 'QUEUED'
        claimedSlots.add(kbId)
        return {
          outcome,
          kb: {
            id: kbId,
            knowledgeGraphEnabled: true,
            activeGraphBuildId: 'build',
            publishedGraphBuildId: null,
          },
          build: null,
        }
      }
    )
    const sweep = () =>
      sweepKbGraphPreparation({
        ...deps,
        env: costEnv,
        now: () => now,
        startBuild,
      })

    const summaries = await Promise.all([sweep(), sweep()])

    expect(startBuild).toHaveBeenCalledWith(
      { kbId: kb.kbId },
      { kind: 'system', ownerId: kb.ownerId },
      expect.anything()
    )
    expect(summaries.map((summary) => summary.admitted).sort()).toEqual([0, 1])
    expect(
      summaries.map((summary) => summary.skipped.ALREADY_ACTIVE).sort()
    ).toEqual([0, 1])
  })

  it('leaves capacity taken by running builds to them', async () => {
    const { deps } = createDeps({ activeBuilds: config.concurrencyCap })
    const startBuild = vi.fn()

    const summary = await sweepKbGraphPreparation({
      ...deps,
      env: costEnv,
      now: () => now,
      startBuild,
    })

    expect(startBuild).not.toHaveBeenCalled()
    expect(summary).toMatchObject({
      due: 1,
      admitted: 0,
      skipped: { CAPACITY: 1 },
    })
  })

  it.each([
    ['requested before the age bound', maxDeferralMinutes + 1, 'due'],
    ['requested inside the quiet period', 10, 'QUIET_PERIOD'],
  ])('times a replaced source that ingestion keeps rewriting from when its serving version was %s', async (_, requestedMinutesAgo, expected) => {
    const { deps } = createDeps({
      servingVersionRequestedAt: minutesAgo(requestedMinutesAgo),
      lastResourceChangeAt: minutesAgo(5),
    })
    const startBuild = vi.fn(
      async (): Promise<KBGraphBuildStart> => ({
        outcome: 'QUEUED',
        kb: {
          id: 'kb',
          knowledgeGraphEnabled: true,
          activeGraphBuildId: 'build',
          publishedGraphBuildId: null,
        },
        build: null,
      })
    )

    const summary = await sweepKbGraphPreparation({
      ...deps,
      env: costEnv,
      now: () => now,
      startBuild,
    })

    expect(summary.due === 1 ? 'due' : 'QUIET_PERIOD').toBe(expected)
    expect(summary.skipped.QUIET_PERIOD).toBe(expected === 'due' ? 0 : 1)
  })

  it('admits nothing while the schedule is misconfigured', async () => {
    const { deps } = createDeps()
    const startBuild = vi.fn()

    const summary = await sweepKbGraphPreparation({
      ...deps,
      env: {
        ...costEnv,
        KB_GRAPH_AUTO_PREPARATION_QUIET_PERIOD_MINUTES: '90',
      },
      now: () => now,
      startBuild,
    })

    expect(summary.status).toBe('CONFIGURATION_INVALID')
    expect(startBuild).not.toHaveBeenCalled()
  })
})

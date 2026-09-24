import { Priority } from '@hatchet-dev/typescript-sdk'
import {
  getDefaultKBGraphDomainCatalog,
  hashKBContentDigestEntries,
  KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV,
} from '@klicker-uzh/knowledge-graph'
import {
  KBGraphBuildOrigin,
  KBGraphBuildStatus,
  KBGraphQualityTier,
  KBResourceType,
} from '@klicker-uzh/prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deriveKBQuestionPreparation,
  getKBGraphBuildConfig,
  getKBGraphPreparationStatus,
  type KBGraphBuildServiceContext,
  type KBGraphPreparationIdentity,
  type KBQuestionPreparationInput,
  startKbKnowledgeGraphBuild,
} from '../src/services/knowledge.js'
import { getKBGraphCostConfiguration } from '../src/services/knowledgeGraphCost.js'

const costEnv = {
  KB_GRAPH_COST_CURRENCY: 'CHF',
  KB_GRAPH_STANDARD_ESTIMATE_MINOR_UNITS: '100',
  KB_GRAPH_HIGH_ESTIMATE_MINOR_UNITS: '200',
  KB_GRAPH_MAX_COST_MINOR_UNITS: '250',
  KB_GRAPH_SEMESTER_QUOTA_MINOR_UNITS: '1000',
  KB_GRAPH_COST_PRICING_VERSION: 'test-v1',
  KB_GRAPH_SEMESTER_KEY: '2026-H2',
}

const build: Parameters<typeof getKBGraphBuildConfig>[1] = {
  id: '11111111-1111-4111-8111-111111111111',
  status: KBGraphBuildStatus.SUCCEEDED,
  statusMessage: null,
  qualityTier: KBGraphQualityTier.STANDARD,
  sourceContentDigest: 'source-digest',
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-08-15T00:00:00.000Z'),
  updatedAt: new Date('2026-08-15T00:00:00.000Z'),
  estimatedCostMinorUnits: 100,
  actualCostMinorUnits: 60,
  actualInputTokens: 11,
  actualOutputTokens: 13,
  actualEmbeddingTokens: 7,
  actualRequestCount: 2,
  costCurrency: 'CHF',
  costStatus: null,
  focusTopic: null,
  quotaId: '22222222-2222-4222-8222-222222222222',
  quota: {
    currency: 'CHF',
    limitMinorUnits: 1000,
    reservedMinorUnits: 0,
    settledMinorUnits: 60,
  },
}

describe('KB knowledge graph config', () => {
  it('reports quota configuration drift and keeps quota currency separate', () => {
    const costConfiguration = getKBGraphCostConfiguration(costEnv)
    const result = getKBGraphBuildConfig(
      {
        id: '33333333-3333-4333-8333-333333333333',
        knowledgeGraphEnabled: true,
        activeGraphBuildId: null,
        publishedGraphBuildId: build.id,
      },
      {
        ...build,
        costCurrency: 'EUR',
      },
      false,
      {
        currency: 'USD',
        limitMinorUnits: 900,
        reservedMinorUnits: 100,
        settledMinorUnits: 50,
      },
      costConfiguration,
      true
    )

    expect(result.costConfigurationReady).toBe(false)
    expect(result.costCurrency).toBe('EUR')
    expect(result.quotaCurrency).toBe('USD')
    expect(result.remainingSemesterQuotaMinorUnits).toBe(750)
    expect(result.elementGenerationReady).toBe(true)
  })

  it('reports a legacy all-null build without any domain selection', () => {
    const costConfiguration = getKBGraphCostConfiguration(costEnv)
    const result = getKBGraphBuildConfig(
      {
        id: '33333333-3333-4333-8333-333333333333',
        knowledgeGraphEnabled: true,
        activeGraphBuildId: null,
        publishedGraphBuildId: null,
      },
      {
        ...build,
        domainPolicyId: null,
        domainPolicyVersion: null,
        domainPolicyLanguage: null,
      },
      false,
      null,
      costConfiguration,
      false
    )

    expect(result).toMatchObject({
      domainPolicyId: null,
      domainPolicyVersion: null,
      domainPolicyLanguage: null,
      publishedDomainPolicyId: null,
      publishedDomainPolicyVersion: null,
      publishedDomainPolicyLanguage: null,
      domainCategories: null,
      focusTopic: null,
    })
  })

  it('reports the selected and published domain metadata separately', () => {
    const costConfiguration = getKBGraphCostConfiguration(costEnv)
    const result = getKBGraphBuildConfig(
      {
        id: '33333333-3333-4333-8333-333333333333',
        knowledgeGraphEnabled: true,
        activeGraphBuildId: null,
        publishedGraphBuildId: '44444444-4444-4444-8444-444444444444',
      },
      {
        ...build,
        domainPolicyId: 'mathematics',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
      },
      false,
      null,
      costConfiguration,
      false,
      {
        domainPolicyId: 'informatics',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'English',
      }
    )

    // The reported build and the published build may carry different frozen
    // selections; neither may overwrite the other.
    expect(result.domainPolicyId).toBe('mathematics')
    expect(result.domainPolicyVersion).toBe(1)
    expect(result.domainPolicyLanguage).toBe('German')
    expect(result.publishedDomainPolicyId).toBe('informatics')
    expect(result.publishedDomainPolicyVersion).toBe(1)
    expect(result.publishedDomainPolicyLanguage).toBe('English')
    expect(result.domainCategories).not.toBeNull()
    expect(result.domainCategories!.length).toBeGreaterThan(0)
  })

  it('does not describe categories for a persisted selection the catalog dropped', () => {
    const costConfiguration = getKBGraphCostConfiguration(costEnv)
    const result = getKBGraphBuildConfig(
      {
        id: '33333333-3333-4333-8333-333333333333',
        knowledgeGraphEnabled: true,
        activeGraphBuildId: null,
        publishedGraphBuildId: null,
      },
      {
        ...build,
        domainPolicyId: 'retired-policy',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
      },
      false,
      null,
      costConfiguration,
      false
    )

    expect(result.domainPolicyId).toBe('retired-policy')
    expect(result.domainCategories).toBeNull()
  })

  it('reports the focus recorded on the build', () => {
    const costConfiguration = getKBGraphCostConfiguration(costEnv)
    const result = getKBGraphBuildConfig(
      {
        id: '33333333-3333-4333-8333-333333333333',
        knowledgeGraphEnabled: true,
        activeGraphBuildId: null,
        publishedGraphBuildId: null,
      },
      { ...build, focusTopic: 'Capital budgeting' },
      false,
      null,
      costConfiguration,
      false
    )

    expect(result.focusTopic).toBe('Capital budgeting')
  })
})

const preparedIdentity: KBGraphPreparationIdentity = {
  domainPolicyId: 'mathematics',
  domainPolicyVersion: 1,
  domainPolicyLanguage: 'German',
  qualityTier: KBGraphQualityTier.STANDARD,
  sourceContentDigest: 'digest-a',
}

describe('KB graph preparation due check', () => {
  it.each([
    ['no graph is published', null, preparedIdentity, 'NO_PUBLISHED_GRAPH'],
    [
      'only the language changed',
      preparedIdentity,
      { ...preparedIdentity, domainPolicyLanguage: 'English' },
      'SETTINGS_CHANGED',
    ],
    [
      'the domain changed',
      preparedIdentity,
      { ...preparedIdentity, domainPolicyId: 'informatics' },
      'SETTINGS_CHANGED',
    ],
    [
      'a higher tier is desired',
      preparedIdentity,
      { ...preparedIdentity, qualityTier: KBGraphQualityTier.HIGH },
      'SETTINGS_CHANGED',
    ],
    [
      'the serving sources changed',
      preparedIdentity,
      { ...preparedIdentity, sourceContentDigest: 'digest-b' },
      'SOURCES_CHANGED',
    ],
  ] as const)('is pending when %s', (_, published, desired, reason) => {
    const status = getKBGraphPreparationStatus({ desired, published })

    expect(status).toMatchObject({ pending: true, due: true, reason })
  })

  it.each([
    [
      'the published tier is higher than desired',
      { ...preparedIdentity, qualityTier: KBGraphQualityTier.HIGH },
      preparedIdentity,
      true,
    ],
    [
      'domain selection is unavailable',
      preparedIdentity,
      {
        ...preparedIdentity,
        domainPolicyId: null,
        domainPolicyVersion: null,
        domainPolicyLanguage: null,
      },
      false,
    ],
  ] as const)('is current when %s', (_, published, desired, available) => {
    const status = getKBGraphPreparationStatus({
      desired,
      published,
      domainSelectionAvailable: available,
    })

    expect(status).toMatchObject({ pending: false, reason: null })
  })

  it('is current for an unchanged preparation and fingerprints settings', () => {
    const current = getKBGraphPreparationStatus({
      desired: preparedIdentity,
      published: preparedIdentity,
    })
    const relabeled = getKBGraphPreparationStatus({
      desired: { ...preparedIdentity, domainPolicyLanguage: 'English' },
      published: preparedIdentity,
    })

    expect(current).toMatchObject({ pending: false, due: false, reason: null })
    expect(relabeled.desiredFingerprint).not.toBe(current.desiredFingerprint)
  })

  it('waits out the quiet period until the age bound overrides it', () => {
    const now = new Date('2026-09-23T12:00:00.000Z')
    const timing = {
      now,
      lastChangeAt: new Date('2026-09-23T11:50:00.000Z'),
      quietPeriodMs: 30 * 60_000,
      pendingSinceAt: new Date('2026-09-23T10:00:00.000Z'),
      maxDeferralMs: 4 * 60 * 60_000,
      lastFailedAt: null,
      backoffMs: 60 * 60_000,
    }
    const published = { ...preparedIdentity, sourceContentDigest: 'old' }

    expect(
      getKBGraphPreparationStatus({
        desired: preparedIdentity,
        published,
        timing,
      })
    ).toMatchObject({
      pending: true,
      due: false,
      deferredUntil: new Date('2026-09-23T12:20:00.000Z'),
    })
    expect(
      getKBGraphPreparationStatus({
        desired: preparedIdentity,
        published,
        timing: {
          ...timing,
          pendingSinceAt: new Date('2026-09-23T07:00:00.000Z'),
        },
      })
    ).toMatchObject({ pending: true, due: true, deferredUntil: null })
    // The age bound never skips the backoff after a failed attempt.
    expect(
      getKBGraphPreparationStatus({
        desired: preparedIdentity,
        published,
        timing: {
          ...timing,
          pendingSinceAt: new Date('2026-09-23T07:00:00.000Z'),
          lastFailedAt: new Date('2026-09-23T11:30:00.000Z'),
        },
      })
    ).toMatchObject({
      due: false,
      deferredUntil: new Date('2026-09-23T12:30:00.000Z'),
    })
  })
})

describe('KB question preparation readiness', () => {
  const now = new Date('2026-09-23T12:00:00.000Z')
  const readyInput: KBQuestionPreparationInput = {
    buildAdmitted: true,
    automaticPreparationAdmitted: true,
    courseContent: { serving: 2, processing: 0, failed: 0 },
    activeBuild: null,
    publishedGraphReady: true,
    preparation: { pending: false, reason: null },
    pendingSinceAt: null,
    now,
    delayedAfterMs: 24 * 60 * 60_000,
  }
  const pending = {
    preparation: { pending: true, reason: 'SOURCES_CHANGED' as const },
    pendingSinceAt: new Date('2026-09-23T11:00:00.000Z'),
  }

  it.each([
    ['a current usable graph', {}, 'READY'],
    [
      'only administrative material',
      { courseContent: { serving: 0, processing: 0, failed: 0 } },
      'NO_ELIGIBLE_MATERIALS',
    ],
    [
      'materials still being ingested',
      {
        ...pending,
        courseContent: { serving: 0, processing: 1, failed: 0 },
      },
      'WAITING_FOR_MATERIALS',
    ],
    [
      'only failed materials',
      {
        ...pending,
        courseContent: { serving: 0, processing: 0, failed: 1 },
      },
      'NEEDS_ATTENTION',
    ],
    ['a pending preparation the scheduler admits', pending, 'QUEUED'],
    [
      'a pending preparation without scheduled admission',
      { ...pending, automaticPreparationAdmitted: false },
      'UNAVAILABLE',
    ],
    [
      'a pending preparation whose build admission closed',
      { ...pending, buildAdmitted: false },
      'UNAVAILABLE',
    ],
    [
      'an accepted build after admission closed',
      {
        ...pending,
        buildAdmitted: false,
        activeBuild: { status: KBGraphBuildStatus.PROCESSING },
      },
      'PROCESSING',
    ],
    [
      'a build pending beyond the delay window',
      {
        ...pending,
        pendingSinceAt: new Date('2026-09-22T11:00:00.000Z'),
        activeBuild: { status: KBGraphBuildStatus.QUEUED },
      },
      'DELAYED',
    ],
    [
      'a current graph without a usable bundle',
      { publishedGraphReady: false },
      'NEEDS_ATTENTION',
    ],
  ] as const)('reports %s', (_, overrides, state) => {
    expect(
      deriveKBQuestionPreparation({ ...readyInput, ...overrides }).state
    ).toBe(state)
  })
})

describe('system-triggered KB graph builds', () => {
  const ownerId = '55555555-5555-4555-8555-555555555555'
  const kbId = '66666666-6666-4666-8666-666666666666'
  const publishedBuildId = '77777777-7777-4777-8777-777777777777'
  const contentSha256 = 'a'.repeat(64)
  const resourceId = '88888888-8888-4888-8888-888888888888'
  const digest = hashKBContentDigestEntries([{ resourceId, contentSha256 }])
  const savedGraphEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('KB_GRAPH_')) {
        savedGraphEnv[key] = process.env[key]
        delete process.env[key]
      }
    }
  })

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('KB_GRAPH_')) delete process.env[key]
    }
    for (const [key, value] of Object.entries(savedGraphEnv)) {
      if (value !== undefined) process.env[key] = value
    }
  })

  function createDeps({
    owner = {
      aiFeaturesEnabled: true,
      betaEnabled: true,
    },
    enabledFlags = ['kb-auto-graph-preparation', 'kb-graph-builds'],
    kbDomain = {
      domainPolicyId: 'mathematics',
      domainPolicyVersion: 1,
      domainPolicyLanguage: 'German',
    },
    publishedDomain = {
      domainPolicyId: null as string | null,
      domainPolicyVersion: null as number | null,
      domainPolicyLanguage: null as string | null,
    },
  }: {
    owner?: { aiFeaturesEnabled: boolean; betaEnabled: boolean } | null
    enabledFlags?: string[]
    kbDomain?: Record<string, unknown>
    publishedDomain?: Record<string, unknown>
  } = {}) {
    const create = vi.fn(async ({ data }: { data: { id: string } }) => ({
      id: data.id,
    }))
    const quotaId = '99999999-9999-4999-8999-999999999999'
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValueOnce([{ id: kbId }]),
      $executeRaw: vi.fn(),
      kB: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: kbId,
          knowledgeGraphEnabled: true,
          activeGraphBuildId: null,
          publishedGraphBuildId: publishedBuildId,
          ...kbDomain,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      kBGraphQuota: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ id: quotaId })
          .mockResolvedValueOnce({
            id: quotaId,
            ownerId,
            semesterKey: costEnv.KB_GRAPH_SEMESTER_KEY,
            currency: costEnv.KB_GRAPH_COST_CURRENCY,
            limitMinorUnits: 1000,
            reservedMinorUnits: 0,
            settledMinorUnits: 0,
          }),
        update: vi.fn(),
      },
      kBResource: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: resourceId,
            title: 'Source',
            type: KBResourceType.URL,
            sourceUrl: 'https://example.com/source',
            blobName: null,
            activeContentSha256: contentSha256,
          },
        ]),
      },
      kBGraphBuild: {
        findFirst: vi.fn().mockResolvedValue({
          ...publishedDomain,
          qualityTier: KBGraphQualityTier.STANDARD,
          sourceContentDigest: digest,
        }),
        create,
      },
    }
    const $transaction = vi.fn((fn: (tx: unknown) => unknown) =>
      fn(transaction)
    )
    const isEnabled = vi.fn((key: string) => enabledFlags.includes(key))
    const getAiBetaDecision = vi.fn(() => 'enabled' as const)
    const deps = {
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue(
            owner && {
              id: ownerId,
              role: 'USER',
              catalystInstitutional: true,
              catalystIndividual: false,
              ...owner,
            }
          ),
        },
        $transaction,
      },
      featureFlags: { isEnabled, getAiBetaDecision, refresh: vi.fn() },
      tasks: { buildKBGraph: { runNoWait: vi.fn() } },
    } as unknown as KBGraphBuildServiceContext
    return {
      deps,
      $transaction,
      isEnabled,
      getAiBetaDecision,
      create,
      transaction,
    }
  }

  const start = (deps: KBGraphBuildServiceContext) =>
    startKbKnowledgeGraphBuild({ kbId }, { kind: 'system', ownerId }, deps)

  it.each([
    ['a missing owner', { owner: null }, 'AI_BETA_ACCESS_REQUIRED'],
    [
      'an owner without AI entitlement',
      { owner: { aiFeaturesEnabled: false, betaEnabled: true } },
      'AI_BETA_ACCESS_REQUIRED',
    ],
    [
      'an owner outside the graph build rollout',
      { enabledFlags: ['kb-auto-graph-preparation'] },
      'KB_GRAPH_DISABLED',
    ],
    [
      'an owner outside automatic preparation',
      { enabledFlags: ['kb-graph-builds'] },
      'KB_GRAPH_DISABLED',
    ],
  ])('refuses %s before touching the KB', async (_, options, code) => {
    const { deps, $transaction } = createDeps(options)

    await expect(start(deps)).rejects.toMatchObject({ extensions: { code } })
    expect($transaction).not.toHaveBeenCalled()
  })

  it('evaluates the rollout for the stored owner, not a session', async () => {
    const { deps, isEnabled } = createDeps()

    await start(deps)

    expect(isEnabled).toHaveBeenCalledWith(
      'kb-graph-builds',
      expect.objectContaining({ id: ownerId, role: 'USER', catalyst: true })
    )
  })

  it('reserves nothing when the published graph already matches', async () => {
    process.env[KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV] =
      getDefaultKBGraphDomainCatalog().revision
    const { deps, create } = createDeps({
      enabledFlags: [
        'kb-auto-graph-preparation',
        'kb-graph-builds',
        'kb-graph-domain-selection',
      ],
      publishedDomain: {
        domainPolicyId: 'mathematics',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
      },
    })

    await expect(start(deps)).resolves.toMatchObject({
      outcome: 'NOT_DUE',
      build: null,
    })
    expect(create).not.toHaveBeenCalled()
  })

  it.each([
    ['domain selection is closed for the owner', {}],
    [
      'the stored subject is not in the catalog',
      {
        enabledFlags: [
          'kb-auto-graph-preparation',
          'kb-graph-builds',
          'kb-graph-domain-selection',
        ],
        kbDomain: {
          domainPolicyId: 'unknown-subject',
          domainPolicyVersion: 1,
          domainPolicyLanguage: 'German',
        },
      },
    ],
  ])('never builds with provider defaults when %s', async (_, options) => {
    Object.assign(process.env, costEnv)
    process.env[KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV] =
      getDefaultKBGraphDomainCatalog().revision
    const { deps, create, transaction } = createDeps(options)

    await expect(start(deps)).resolves.toMatchObject({
      outcome: 'UNSUPPORTED_SETTINGS',
      build: null,
    })
    expect(transaction.kBGraphQuota.findUniqueOrThrow).not.toHaveBeenCalled()
    expect(transaction.kB.updateMany).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(deps.tasks.buildKBGraph.runNoWait).not.toHaveBeenCalled()
  })

  it('admits a language change through the cost gate', async () => {
    process.env[KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV] =
      getDefaultKBGraphDomainCatalog().revision
    const { deps, create } = createDeps({
      enabledFlags: [
        'kb-auto-graph-preparation',
        'kb-graph-builds',
        'kb-graph-domain-selection',
      ],
      publishedDomain: {
        domainPolicyId: 'mathematics',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'English',
      },
    })

    await expect(start(deps)).rejects.toMatchObject({
      extensions: { code: 'KB_GRAPH_COST_CONFIGURATION_MISSING' },
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('records an admitted build as automatic and queues it at low priority', async () => {
    Object.assign(process.env, costEnv)
    process.env[KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV] =
      getDefaultKBGraphDomainCatalog().revision
    const { deps, create } = createDeps({
      enabledFlags: [
        'kb-auto-graph-preparation',
        'kb-graph-builds',
        'kb-graph-domain-selection',
      ],
      publishedDomain: {
        domainPolicyId: 'mathematics',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'English',
      },
    })

    await expect(start(deps)).resolves.toMatchObject({ outcome: 'QUEUED' })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          origin: KBGraphBuildOrigin.SYSTEM,
          requestedById: ownerId,
        }),
      })
    )
    expect(deps.tasks.buildKBGraph.runNoWait).toHaveBeenCalledWith(
      { buildId: expect.any(String) },
      { priority: Priority.LOW }
    )
  })
})

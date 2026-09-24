import { hashKBContentDigestEntries } from '@klicker-uzh/knowledge-graph'
import {
  KBGraphBuildStatus,
  KBGraphQualityTier,
} from '@klicker-uzh/prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import type { KBGraphPreparationCandidate } from '../src/services/knowledgeGraphPreparation.js'

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  published: vi.fn(),
  findBuild: vi.fn(),
  findBuilds: vi.fn(),
  findKnowledgeBases: vi.fn(),
  findOwner: vi.fn(),
  groupResources: vi.fn(),
  candidates: vi.fn(),
}))
vi.mock('../src/lib/manageAiFeatureGate.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  assertManageAiEnabled: mocks.access,
}))
vi.mock('@klicker-uzh/knowledge-graph', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPublishedKnowledgeGraph: mocks.published,
}))
vi.mock(
  '../src/services/knowledgeGraphPreparation.js',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    loadKBGraphPreparationCandidates: mocks.candidates,
  })
)

import {
  assertQuestionGenerationBasisCurrent,
  assertQuestionGenerationGraphEligible,
  getQuestionGenerationSources,
  type QuestionGenerationSourceInputs,
  resolveQuestionGenerationSource,
} from '../src/services/questionGenerationGraph.js'

const ctx = {
  user: { sub: 'synthetic-owner' },
  prisma: {
    kBGraphBuild: { findFirst: mocks.findBuild, findMany: mocks.findBuilds },
    kB: { findMany: mocks.findKnowledgeBases },
    kBResource: { groupBy: mocks.groupResources },
    user: { findUnique: mocks.findOwner },
  },
} as unknown as ContextWithUser

type PublishedBuild = NonNullable<
  QuestionGenerationSourceInputs['publishedBuild']
>

const NOW = new Date('2026-09-10T00:00:00Z')
const PREPARED_AT = new Date('2026-09-01T00:00:00Z')

function graphBuild(
  domainPolicyLanguage: string | null,
  overrides: { id?: string; kbId?: string; resourceIds?: string[] } = {}
): PublishedBuild {
  return {
    id: overrides.id ?? 'synthetic-build',
    kbId: overrides.kbId ?? 'synthetic-kb',
    status: KBGraphBuildStatus.SUCCEEDED,
    graphName: 'synthetic-graph',
    graphBundleContainerName: 'synthetic-container',
    graphBundleBlobPrefix: 'synthetic-prefix',
    graphBundleStorageName: 'synthetic-storage',
    graphBundleSha256: 'a'.repeat(64),
    graphSha256: 'b'.repeat(64),
    graphManifestSchemaVersion: 2,
    graphManifestArtifact: { key: 'manifest.json' },
    domainPolicyLanguage,
    finishedAt: PREPARED_AT,
    createdAt: PREPARED_AT,
    sources: (overrides.resourceIds ?? ['resource-a']).map((resourceId) => ({
      resourceId,
      title: `Synthetic ${resourceId}`,
      contentSha256: `sha-${resourceId}`,
      sourceUrl: null,
      blobName: null,
    })),
  } as unknown as PublishedBuild
}

type Resource = { id: string; sha: string }

function published(resources: Resource[]) {
  const entries = resources.map((resource) => ({
    resourceId: resource.id,
    contentSha256: resource.sha,
  }))
  return {
    domainPolicyId: null,
    domainPolicyVersion: null,
    domainPolicyLanguage: null,
    qualityTier: KBGraphQualityTier.STANDARD,
    sourceContentDigest: hashKBContentDigestEntries(entries),
    createdAt: PREPARED_AT,
    sources: entries,
  }
}

function candidate(
  kbId: string,
  {
    serving = [{ id: 'resource-a', sha: 'sha-resource-a' }],
    snapshot = serving,
    hasPublished = true,
  }: {
    serving?: Resource[]
    snapshot?: Resource[]
    hasPublished?: boolean
  } = {}
): KBGraphPreparationCandidate {
  return {
    kbId,
    ownerId: 'synthetic-owner',
    graphSettingsChangedAt: PREPARED_AT,
    domainPolicyId: null,
    domainPolicyVersion: null,
    domainPolicyLanguage: null,
    servingResources: serving.map((resource) => ({
      id: resource.id,
      activeContentSha256: resource.sha,
      createdAt: PREPARED_AT,
      servingVersionRequestedAt: PREPARED_AT,
    })),
    lastResourceChangeAt: PREPARED_AT,
    activeBuild: null,
    published: hasPublished ? published(snapshot) : null,
    deletedPublishedSources: [],
    recentBuilds: [],
  }
}

function inputs(
  overrides: Partial<QuestionGenerationSourceInputs> = {}
): QuestionGenerationSourceInputs {
  return {
    kb: { id: 'synthetic-kb', name: 'Synthetic course' },
    candidate: candidate('synthetic-kb'),
    publishedBuild: graphBuild('German'),
    courseContent: { processing: 0, failed: 0 },
    admission: {
      buildAdmitted: true,
      automaticPreparationAdmitted: true,
      domainCapabilityEnabled: false,
    },
    now: NOW,
    ...overrides,
  }
}

describe('question generation graph language', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.published.mockResolvedValue({
      buildId: 'synthetic-build',
      isStale: false,
    })
  })

  it.each([
    ['German', 'de'],
    ['English', 'en'],
    [null, 'de'],
  ])('carries stored %s through eligibility and the source basis as %s', async (stored, expected) => {
    mocks.findBuild.mockImplementation(async ({ select }) => {
      const build = graphBuild(stored)
      return Object.fromEntries(
        Object.entries(build).filter(([key]) => select[key])
      )
    })
    const graph = await assertQuestionGenerationGraphEligible(
      'synthetic-build',
      ctx
    )
    expect(graph.language).toBe(expected)
    expect(
      resolveQuestionGenerationSource(
        inputs({ publishedBuild: graphBuild(stored) })
      ).basis
    ).toMatchObject({ graphBuildId: graph.id, language: expected })
    expect(mocks.findBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'synthetic-build',
          kb: { is: { ownerId: ctx.user.sub, deletedAt: null } },
        },
      })
    )
  })

  it.each([
    'French',
    '',
    'en',
  ])('rejects unsupported explicit language %s instead of defaulting', async (language) => {
    mocks.findBuild.mockResolvedValue(graphBuild(language))
    await expect(
      assertQuestionGenerationGraphEligible('synthetic-build', ctx)
    ).rejects.toMatchObject({
      code: 'KB_GRAPH_VERSION_NOT_ELIGIBLE',
    })
    expect(
      resolveQuestionGenerationSource(
        inputs({ publishedBuild: graphBuild(language) })
      ).basis
    ).toBeNull()
  })
})

describe('question generation source readiness', () => {
  it.each([
    {
      name: 'a current usable graph',
      overrides: {},
      state: 'READY',
      pendingReason: null,
      hasBasis: true,
    },
    {
      name: 'a KB whose first graph is being prepared',
      overrides: {
        candidate: {
          ...candidate('synthetic-kb', { hasPublished: false }),
          activeBuild: {
            status: KBGraphBuildStatus.PROCESSING,
            errorCode: null,
          },
        },
        publishedBuild: null,
        // Within the delay window; a longer wait reports DELAYED.
        now: new Date(PREPARED_AT.getTime() + 60_000),
      },
      state: 'PROCESSING',
      pendingReason: 'NO_PUBLISHED_GRAPH',
      hasBasis: false,
    },
    {
      name: 'a KB scheduled preparation cannot prepare',
      overrides: {
        candidate: candidate('synthetic-kb', { hasPublished: false }),
        publishedBuild: null,
      },
      state: 'UNAVAILABLE',
      pendingReason: 'NO_PUBLISHED_GRAPH',
      hasBasis: false,
    },
    {
      name: 'a current graph without a generation bundle',
      overrides: {
        publishedBuild: { ...graphBuild('German'), graphBundleSha256: null },
      },
      state: 'NEEDS_ATTENTION',
      pendingReason: null,
      hasBasis: false,
    },
    {
      name: 'a KB without course material',
      overrides: {
        candidate: candidate('synthetic-kb', {
          serving: [],
          hasPublished: false,
        }),
        publishedBuild: null,
      },
      state: 'NO_ELIGIBLE_MATERIALS',
      pendingReason: 'NO_PUBLISHED_GRAPH',
      hasBasis: false,
    },
  ] as const)('maps $name to $state', ({
    overrides,
    state,
    pendingReason,
    hasBasis,
  }) => {
    const source = resolveQuestionGenerationSource(
      inputs(overrides as Partial<QuestionGenerationSourceInputs>)
    )
    expect(source).toMatchObject({
      kbId: 'synthetic-kb',
      preparationState: state,
      preparationPendingReason: pendingReason,
    })
    expect(source.basis !== null).toBe(hasBasis)
  })

  it.each([
    [
      'an added source',
      [
        { id: 'resource-a', sha: 'sha-resource-a' },
        { id: 'resource-b', sha: 'sha-resource-b' },
      ],
    ],
    ['an updated source', [{ id: 'resource-a', sha: 'sha-resource-a-v2' }]],
  ])('keeps the published basis after %s and marks recent changes excluded', (_, serving) => {
    const source = resolveQuestionGenerationSource(
      inputs({
        candidate: candidate('synthetic-kb', {
          serving,
          snapshot: [{ id: 'resource-a', sha: 'sha-resource-a' }],
        }),
      })
    )
    expect(source.preparationPendingReason).toBe('SOURCES_CHANGED')
    expect(source.basis).toMatchObject({
      graphBuildId: 'synthetic-build',
      recentChangesExcluded: true,
      sourceCount: 1,
    })
  })

  it('withdraws the basis once a snapshot source stops serving', () => {
    const source = resolveQuestionGenerationSource(
      inputs({
        candidate: candidate('synthetic-kb', {
          serving: [{ id: 'resource-b', sha: 'sha-resource-b' }],
          snapshot: [
            { id: 'resource-a', sha: 'sha-resource-a' },
            { id: 'resource-b', sha: 'sha-resource-b' },
          ],
        }),
        publishedBuild: graphBuild('German', {
          resourceIds: ['resource-a', 'resource-b'],
        }),
      })
    )
    expect(source.preparationPendingReason).toBe('SOURCES_CHANGED')
    expect(source.basis).toBeNull()
  })
})

describe('question generation source listing and basis revalidation', () => {
  function kb(id: string, name: string, publishedGraphBuildId: string | null) {
    return { id, name, knowledgeGraphEnabled: true, publishedGraphBuildId }
  }

  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findOwner.mockResolvedValue(null)
    mocks.groupResources.mockResolvedValue([])
    mocks.findKnowledgeBases.mockResolvedValue([
      kb('kb-ready', 'Ready course', 'build-ready'),
      kb('kb-unready', 'Unready course', null),
    ])
    mocks.candidates.mockResolvedValue([
      candidate('kb-ready'),
      candidate('kb-unready', { hasPublished: false }),
    ])
    mocks.findBuilds.mockResolvedValue([
      graphBuild('English', { id: 'build-ready', kbId: 'kb-ready' }),
    ])
  })

  it('lists every owned KB with its readiness from one batch of reads', async () => {
    const sources = await getQuestionGenerationSources(ctx)

    expect(sources).toEqual([
      expect.objectContaining({
        kbId: 'kb-ready',
        preparationState: 'READY',
        basis: expect.objectContaining({ graphBuildId: 'build-ready' }),
      }),
      expect.objectContaining({
        kbId: 'kb-unready',
        preparationState: 'UNAVAILABLE',
        preparationPendingReason: 'NO_PUBLISHED_GRAPH',
        basis: null,
      }),
    ])
    expect(mocks.findKnowledgeBases).toHaveBeenCalledTimes(1)
    expect(mocks.candidates).toHaveBeenCalledTimes(1)
    expect(mocks.findBuilds).toHaveBeenCalledTimes(1)
    expect(mocks.groupResources).toHaveBeenCalledTimes(1)
    expect(mocks.findKnowledgeBases).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: ctx.user.sub, deletedAt: null },
      })
    )
  })

  it('accepts the current basis of the requested KB', async () => {
    const [ready] = await getQuestionGenerationSources(ctx)
    await expect(
      assertQuestionGenerationBasisCurrent(
        {
          kbId: 'kb-ready',
          graphBuildId: 'build-ready',
          basisFingerprint: ready?.basis?.fingerprint ?? '',
        },
        ctx
      )
    ).resolves.toBeUndefined()
    expect(mocks.findKnowledgeBases).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'kb-ready', ownerId: ctx.user.sub, deletedAt: null },
      })
    )
  })

  it.each([
    ['a different build', { graphBuildId: 'build-older' }],
    ['a changed preparation identity', { basisFingerprint: 'stale' }],
  ])('rejects %s without substituting the current graph', async (_, change) => {
    const [ready] = await getQuestionGenerationSources(ctx)
    await expect(
      assertQuestionGenerationBasisCurrent(
        {
          kbId: 'kb-ready',
          graphBuildId: 'build-ready',
          basisFingerprint: ready?.basis?.fingerprint ?? '',
          ...change,
        },
        ctx
      )
    ).rejects.toMatchObject({ code: 'KB_GRAPH_BASIS_CHANGED' })
  })

  it('rejects a foreign or missing KB instead of falling back to another', async () => {
    const [ready] = await getQuestionGenerationSources(ctx)
    // The owner filter returns nothing for a KB the actor does not own.
    mocks.findKnowledgeBases.mockResolvedValue([])
    mocks.candidates.mockResolvedValue([])
    await expect(
      assertQuestionGenerationBasisCurrent(
        {
          kbId: 'kb-foreign',
          graphBuildId: 'build-ready',
          basisFingerprint: ready?.basis?.fingerprint ?? '',
        },
        ctx
      )
    ).rejects.toMatchObject({ code: 'KB_GRAPH_BASIS_CHANGED' })
    expect(mocks.candidates).toHaveBeenLastCalledWith(ctx.prisma, {
      id: 'kb-foreign',
      ownerId: ctx.user.sub,
      deletedAt: null,
    })
  })

  it('rejects the basis of a KB that no longer has an eligible graph', async () => {
    const [ready] = await getQuestionGenerationSources(ctx)
    mocks.candidates.mockResolvedValue([
      candidate('kb-ready', {
        serving: [],
        snapshot: [{ id: 'resource-a', sha: 'sha-resource-a' }],
      }),
    ])
    await expect(
      assertQuestionGenerationBasisCurrent(
        {
          kbId: 'kb-ready',
          graphBuildId: 'build-ready',
          basisFingerprint: ready?.basis?.fingerprint ?? '',
        },
        ctx
      )
    ).rejects.toMatchObject({ code: 'KB_GRAPH_BASIS_CHANGED' })
  })
})

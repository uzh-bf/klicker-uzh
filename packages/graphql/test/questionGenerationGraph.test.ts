import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  published: vi.fn(),
  findBuild: vi.fn(),
  findKnowledgeBases: vi.fn(),
}))
vi.mock('../src/lib/manageAiFeatureGate.js', () => ({
  assertManageAiEnabled: mocks.access,
}))
vi.mock('@klicker-uzh/knowledge-graph', () => ({
  getPublishedKnowledgeGraph: mocks.published,
  KnowledgeGraphNotPublishedError: class extends Error {},
}))

import {
  assertQuestionGenerationGraphEligible,
  getQuestionGenerationSources,
} from '../src/services/questionGenerationGraph.js'

const ctx = {
  user: { sub: 'synthetic-owner' },
  prisma: {
    kBGraphBuild: { findFirst: mocks.findBuild },
    kB: { findMany: mocks.findKnowledgeBases },
  },
} as unknown as ContextWithUser

function graphBuild(domainPolicyLanguage: string | null) {
  return {
    id: 'synthetic-build',
    kbId: 'synthetic-kb',
    status: 'SUCCEEDED',
    graphName: 'synthetic-graph',
    graphBundleContainerName: 'synthetic-container',
    graphBundleBlobPrefix: 'synthetic-prefix',
    graphBundleStorageName: 'synthetic-storage',
    graphBundleSha256: 'a'.repeat(64),
    graphSha256: 'b'.repeat(64),
    graphManifestSchemaVersion: 2,
    graphManifestArtifact: { key: 'manifest.json' },
    domainPolicyLanguage,
    finishedAt: new Date('2026-09-01T00:00:00Z'),
    createdAt: new Date('2026-09-01T00:00:00Z'),
    sources: [],
  }
}

describe('question generation graph language', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.published.mockResolvedValue({
      buildId: 'synthetic-build',
      isStale: false,
    })
    mocks.findKnowledgeBases.mockResolvedValue([
      {
        id: 'synthetic-kb',
        name: 'Synthetic course',
        publishedGraphBuildId: 'synthetic-build',
      },
    ])
  })

  it.each([
    ['German', 'de'],
    ['English', 'en'],
    [null, 'de'],
  ])('carries stored %s through eligibility and source discovery as %s', async (stored, expected) => {
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
    expect(await getQuestionGenerationSources(ctx)).toEqual([
      expect.objectContaining({ graphBuildId: graph.id, language: expected }),
    ])
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
    expect(await getQuestionGenerationSources(ctx)).toEqual([])
  })
})

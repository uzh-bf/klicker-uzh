import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  hashKBCanonicalInputReferences,
  hashKBContentDigestEntries,
} from '../src/digest.js'
import {
  KnowledgeGraphNotPublishedError,
  getPublishedKnowledgeGraph,
} from '../src/publication.js'

type MockKB = {
  publishedGraphBuildId: string | null
  resources: { id: string; title: string }[]
} | null

type MockBuild = {
  id: string
  kbId: string
  status: 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'
  graphName: string
  sourceContentDigest: string
  sourceInputContract?: string | null
  sourceInputDigest?: string | null
  sources?: { resourceId: string; title: string }[]
} | null

type MockServingResource = {
  id: string
  activeContentSha256: string | null
  activeResourceVersion?: number | null
  activeCanonicalInput?: unknown
  ingestionOperation?: string
}

function mockPrisma({
  kb,
  publishedBuild = null,
  latestBuild = null,
  servingResources = [],
}: {
  kb: MockKB
  publishedBuild?: MockBuild
  latestBuild?: { status: string } | null
  servingResources?: MockServingResource[]
}): PrismaClient {
  return {
    kB: { findFirst: vi.fn().mockResolvedValue(kb) },
    kBGraphBuild: {
      findFirst: vi.fn().mockResolvedValue(latestBuild),
      findUnique: vi.fn().mockResolvedValue(publishedBuild),
    },
    kBResource: { findMany: vi.fn().mockResolvedValue(servingResources) },
  } as unknown as PrismaClient
}

const RESOURCES = [
  { id: 'resource-a', title: 'First' },
  { id: 'resource-b', title: 'Second' },
]

const SOURCES = RESOURCES.map(({ id, title }) => ({ resourceId: id, title }))

const SERVING = [
  { id: 'resource-a', activeContentSha256: 'sha-a' },
  { id: 'resource-b', activeContentSha256: 'sha-b' },
]

const CURRENT_DIGEST = hashKBContentDigestEntries([
  { resourceId: 'resource-a', contentSha256: 'sha-a' },
  { resourceId: 'resource-b', contentSha256: 'sha-b' },
])

function canonicalReference({
  resourceId,
  resourceVersion,
  sourceSha256,
  parserRecipeSha256 = '2'.repeat(64),
}: {
  resourceId: string
  resourceVersion: number
  sourceSha256: string
  parserRecipeSha256?: string
}) {
  return {
    contract_version: 'canonical-document/v1' as const,
    producer_id: 'klicker',
    project_id: 'klicker-course-materials',
    kb_id: 'kb-id',
    external_resource_id: resourceId,
    resource_version: resourceVersion,
    source_sha256: sourceSha256,
    canonical_sha256: '1'.repeat(64),
    parser_recipe_sha256: parserRecipeSha256,
    byte_count: 2048,
  }
}

const CANONICAL_SHA_A = 'd'.repeat(64)
const CANONICAL_SHA_B = 'e'.repeat(64)
const CANONICAL_REFERENCE_A = canonicalReference({
  resourceId: 'resource-a',
  resourceVersion: 4,
  sourceSha256: CANONICAL_SHA_A,
})
const CANONICAL_REFERENCE_B = canonicalReference({
  resourceId: 'resource-b',
  resourceVersion: 7,
  sourceSha256: CANONICAL_SHA_B,
})
const CANONICAL_SERVING_A: MockServingResource = {
  id: 'resource-a',
  activeContentSha256: CANONICAL_SHA_A,
  activeResourceVersion: 4,
  activeCanonicalInput: CANONICAL_REFERENCE_A,
  ingestionOperation: 'UPSERT',
}
const CANONICAL_SERVING_B: MockServingResource = {
  id: 'resource-b',
  activeContentSha256: CANONICAL_SHA_B,
  activeResourceVersion: 7,
  activeCanonicalInput: CANONICAL_REFERENCE_B,
  ingestionOperation: 'UPSERT',
}
const CANONICAL_CONTENT_DIGEST = hashKBContentDigestEntries([
  { resourceId: 'resource-a', contentSha256: CANONICAL_SHA_A },
  { resourceId: 'resource-b', contentSha256: CANONICAL_SHA_B },
])
const CANONICAL_INPUT_DIGEST = hashKBCanonicalInputReferences([
  CANONICAL_REFERENCE_A,
  CANONICAL_REFERENCE_B,
])
const CANONICAL_PUBLISHED_BUILD = {
  id: 'build-1',
  kbId: 'kb-id',
  status: 'SUCCEEDED' as const,
  graphName: 'klickeruzh:kb:kb-id:build-1',
  sourceContentDigest: CANONICAL_CONTENT_DIGEST,
  sourceInputContract: 'canonical-document/v1',
  sourceInputDigest: CANONICAL_INPUT_DIGEST,
  sources: SOURCES,
}

const originalCanonicalInputEnabled = process.env.KB_CANONICAL_INPUT_ENABLED

afterEach(() => {
  if (originalCanonicalInputEnabled === undefined) {
    delete process.env.KB_CANONICAL_INPUT_ENABLED
  } else {
    process.env.KB_CANONICAL_INPUT_ENABLED = originalCanonicalInputEnabled
  }
})

describe('knowledge graph publication guard', () => {
  it('marks changed canonical lineage stale for callers to enforce their policy', async () => {
    const prisma = mockPrisma({
      kb: { publishedGraphBuildId: 'build-1', resources: RESOURCES },
      publishedBuild: {
        id: 'build-1',
        kbId: 'kb-id',
        status: 'SUCCEEDED',
        graphName: 'klickeruzh:kb:kb-id:build-1',
        sourceContentDigest: CURRENT_DIGEST,
        sourceInputContract: 'canonical-document/v1',
        sourceInputDigest: 'a'.repeat(64),
        sources: SOURCES,
      },
      servingResources: SERVING,
    })
    await expect(getPublishedKnowledgeGraph(prisma, 'kb-id')).resolves.toEqual(
      expect.objectContaining({ isStale: true })
    )
  })
  it('serves the published build under the name it was written to', async () => {
    const prisma = mockPrisma({
      kb: { publishedGraphBuildId: 'build-1', resources: RESOURCES },
      publishedBuild: {
        id: 'build-1',
        kbId: 'kb-id',
        status: 'SUCCEEDED',
        graphName: 'klickeruzh:kb:kb-id:build-1',
        sourceContentDigest: CURRENT_DIGEST,
        sources: SOURCES,
      },
      servingResources: SERVING,
    })

    await expect(getPublishedKnowledgeGraph(prisma, 'kb-id')).resolves.toEqual({
      kbId: 'kb-id',
      buildId: 'build-1',
      graphName: 'klickeruzh:kb:kb-id:build-1',
      isStale: false,
      sources: [
        { resourceId: 'resource-a', title: 'First' },
        { resourceId: 'resource-b', title: 'Second' },
      ],
    })
  })

  // The rule this inverts: the chatbot-owned predecessor treated a stale graph as
  // unpublished and served nothing.
  it('keeps serving a stale build, labelled rather than withheld', async () => {
    const prisma = mockPrisma({
      kb: { publishedGraphBuildId: 'build-1', resources: RESOURCES },
      publishedBuild: {
        id: 'build-1',
        kbId: 'kb-id',
        status: 'SUCCEEDED',
        graphName: 'klickeruzh:kb:kb-id:build-1',
        sourceContentDigest: 'digest-from-an-older-content-set',
        sources: SOURCES,
      },
      servingResources: SERVING,
    })

    await expect(getPublishedKnowledgeGraph(prisma, 'kb-id')).resolves.toEqual(
      expect.objectContaining({ buildId: 'build-1', isStale: true })
    )
  })

  it('keeps serving while a newer build is still running', async () => {
    const prisma = mockPrisma({
      kb: { publishedGraphBuildId: 'build-1', resources: RESOURCES },
      publishedBuild: {
        id: 'build-1',
        kbId: 'kb-id',
        status: 'SUCCEEDED',
        graphName: 'klickeruzh:kb:kb-id:build-1',
        sourceContentDigest: CURRENT_DIGEST,
        sources: SOURCES,
      },
      latestBuild: { status: 'PROCESSING' },
      servingResources: SERVING,
    })

    await expect(getPublishedKnowledgeGraph(prisma, 'kb-id')).resolves.toEqual(
      expect.objectContaining({ buildId: 'build-1', isStale: false })
    )
  })

  it('uses the build-local source snapshot after a resource changes', async () => {
    const snapshot = [{ resourceId: 'resource-a', title: 'Original title' }]
    const prisma = mockPrisma({
      kb: { publishedGraphBuildId: 'build-1', resources: RESOURCES },
      publishedBuild: {
        id: 'build-1',
        kbId: 'kb-id',
        status: 'SUCCEEDED',
        graphName: 'klickeruzh:kb:kb-id:build-1',
        sourceContentDigest: 'digest-from-an-older-content-set',
        sources: snapshot,
      },
      servingResources: SERVING,
    })

    await expect(
      getPublishedKnowledgeGraph(prisma, 'kb-id')
    ).resolves.toMatchObject({
      sources: snapshot,
      isStale: true,
    })
  })

  it.each([
    [
      'a queued build',
      {
        id: 'build-1',
        kbId: 'kb-id',
        status: 'QUEUED' as const,
        graphName: 'klickeruzh:kb:kb-id:build-1',
        sourceContentDigest: CURRENT_DIGEST,
      },
    ],
    [
      'a failed build',
      {
        id: 'build-1',
        kbId: 'kb-id',
        status: 'FAILED' as const,
        graphName: 'klickeruzh:kb:kb-id:build-1',
        sourceContentDigest: CURRENT_DIGEST,
      },
    ],
    [
      'a build owned by another KB',
      {
        id: 'build-1',
        kbId: 'other-kb',
        status: 'SUCCEEDED' as const,
        graphName: 'klickeruzh:kb:other-kb:build-1',
        sourceContentDigest: CURRENT_DIGEST,
      },
    ],
  ])('rejects a published pointer to %s', async (_, publishedBuild) => {
    const promise = getPublishedKnowledgeGraph(
      mockPrisma({
        kb: { publishedGraphBuildId: 'build-1', resources: RESOURCES },
        publishedBuild,
      }),
      'kb-id'
    )

    await expect(promise).rejects.toMatchObject({ code: 'EMPTY' })
  })

  it.each([
    ['deleted or missing KB', { kb: null }, 'EMPTY'],
    [
      'KB that has never been built',
      { kb: { publishedGraphBuildId: null, resources: RESOURCES } },
      'EMPTY',
    ],
    [
      'first build still queued',
      {
        kb: { publishedGraphBuildId: null, resources: RESOURCES },
        latestBuild: { status: 'QUEUED' },
      },
      'QUEUED',
    ],
    [
      'first build still processing',
      {
        kb: { publishedGraphBuildId: null, resources: RESOURCES },
        latestBuild: { status: 'PROCESSING' },
      },
      'PROCESSING',
    ],
    [
      'first build failed',
      {
        kb: { publishedGraphBuildId: null, resources: RESOURCES },
        latestBuild: { status: 'FAILED' },
      },
      'FAILED',
    ],
    [
      'published pointer with no build behind it',
      {
        kb: { publishedGraphBuildId: 'build-gone', resources: RESOURCES },
        publishedBuild: null,
      },
      'EMPTY',
    ],
  ])('rejects a %s', async (_, options, code) => {
    const promise = getPublishedKnowledgeGraph(mockPrisma(options), 'kb-id')

    await expect(promise).rejects.toBeInstanceOf(
      KnowledgeGraphNotPublishedError
    )
    await expect(promise).rejects.toMatchObject({ code })
  })
})

describe('canonical knowledge graph publication guard', () => {
  it('serves a canonical build whose frozen lineage still matches', async () => {
    process.env.KB_CANONICAL_INPUT_ENABLED = 'true'
    const prisma = mockPrisma({
      kb: { publishedGraphBuildId: 'build-1', resources: RESOURCES },
      publishedBuild: CANONICAL_PUBLISHED_BUILD,
      servingResources: [CANONICAL_SERVING_A, CANONICAL_SERVING_B],
    })

    await expect(getPublishedKnowledgeGraph(prisma, 'kb-id')).resolves.toEqual({
      kbId: 'kb-id',
      buildId: 'build-1',
      graphName: 'klickeruzh:kb:kb-id:build-1',
      isStale: false,
      sources: SOURCES,
    })
  })

  it('serves a canonical build while canonical input is disabled', async () => {
    delete process.env.KB_CANONICAL_INPUT_ENABLED
    const prisma = mockPrisma({
      kb: { publishedGraphBuildId: 'build-1', resources: RESOURCES },
      publishedBuild: CANONICAL_PUBLISHED_BUILD,
      servingResources: [CANONICAL_SERVING_A, CANONICAL_SERVING_B],
    })

    await expect(getPublishedKnowledgeGraph(prisma, 'kb-id')).resolves.toEqual(
      expect.objectContaining({ buildId: 'build-1', isStale: false })
    )
  })

  it('marks a canonical build stale after a parser-only change with unchanged raw bytes', async () => {
    process.env.KB_CANONICAL_INPUT_ENABLED = 'true'
    const prisma = mockPrisma({
      kb: { publishedGraphBuildId: 'build-1', resources: RESOURCES },
      publishedBuild: CANONICAL_PUBLISHED_BUILD,
      servingResources: [
        {
          ...CANONICAL_SERVING_A,
          activeCanonicalInput: canonicalReference({
            resourceId: 'resource-a',
            resourceVersion: 4,
            sourceSha256: CANONICAL_SHA_A,
            parserRecipeSha256: '3'.repeat(64),
          }),
        },
        CANONICAL_SERVING_B,
      ],
    })

    await expect(getPublishedKnowledgeGraph(prisma, 'kb-id')).resolves.toEqual(
      expect.objectContaining({ buildId: 'build-1', isStale: true })
    )
  })

  it('marks a canonical build stale after the served source version was replaced', async () => {
    process.env.KB_CANONICAL_INPUT_ENABLED = 'true'
    const replacedSha256 = '4'.repeat(64)
    const prisma = mockPrisma({
      kb: { publishedGraphBuildId: 'build-1', resources: RESOURCES },
      publishedBuild: CANONICAL_PUBLISHED_BUILD,
      servingResources: [
        {
          id: 'resource-a',
          activeContentSha256: replacedSha256,
          activeResourceVersion: 5,
          activeCanonicalInput: canonicalReference({
            resourceId: 'resource-a',
            resourceVersion: 5,
            sourceSha256: replacedSha256,
          }),
          ingestionOperation: 'UPSERT',
        },
        CANONICAL_SERVING_B,
      ],
    })

    await expect(getPublishedKnowledgeGraph(prisma, 'kb-id')).resolves.toEqual(
      expect.objectContaining({ buildId: 'build-1', isStale: true })
    )
  })

  it('marks a canonical build stale when a source is admitted for deletion', async () => {
    process.env.KB_CANONICAL_INPUT_ENABLED = 'true'
    const prisma = mockPrisma({
      kb: { publishedGraphBuildId: 'build-1', resources: RESOURCES },
      publishedBuild: CANONICAL_PUBLISHED_BUILD,
      servingResources: [
        { ...CANONICAL_SERVING_A, ingestionOperation: 'DELETE' },
        CANONICAL_SERVING_B,
      ],
    })

    await expect(getPublishedKnowledgeGraph(prisma, 'kb-id')).resolves.toEqual(
      expect.objectContaining({ buildId: 'build-1', isStale: true })
    )
  })

  it('keeps legacy semantics for a build without the canonical discriminator', async () => {
    const prisma = mockPrisma({
      kb: { publishedGraphBuildId: 'build-1', resources: RESOURCES },
      publishedBuild: {
        id: 'build-1',
        kbId: 'kb-id',
        status: 'SUCCEEDED',
        graphName: 'klickeruzh:kb:kb-id:build-1',
        sourceContentDigest: CANONICAL_CONTENT_DIGEST,
        sources: SOURCES,
      },
      servingResources: [CANONICAL_SERVING_A, CANONICAL_SERVING_B],
    })

    await expect(getPublishedKnowledgeGraph(prisma, 'kb-id')).resolves.toEqual(
      expect.objectContaining({ buildId: 'build-1', isStale: false })
    )
  })
})

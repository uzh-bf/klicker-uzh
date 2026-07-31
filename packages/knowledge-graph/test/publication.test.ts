import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'

import { hashKBContentDigestEntries } from '../src/digest.js'
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
  graphName: string
  sourceContentDigest: string
} | null

function mockPrisma({
  kb,
  publishedBuild = null,
  latestBuild = null,
  servingResources = [],
}: {
  kb: MockKB
  publishedBuild?: MockBuild
  latestBuild?: { status: string } | null
  servingResources?: { id: string; activeContentSha256: string | null }[]
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

const SERVING = [
  { id: 'resource-a', activeContentSha256: 'sha-a' },
  { id: 'resource-b', activeContentSha256: 'sha-b' },
]

const CURRENT_DIGEST = hashKBContentDigestEntries([
  { resourceId: 'resource-a', contentSha256: 'sha-a' },
  { resourceId: 'resource-b', contentSha256: 'sha-b' },
])

describe('knowledge graph publication guard', () => {
  it('serves the published build under the name it was written to', async () => {
    const prisma = mockPrisma({
      kb: { publishedGraphBuildId: 'build-1', resources: RESOURCES },
      publishedBuild: {
        id: 'build-1',
        graphName: 'klickeruzh:kb:kb-id:build-1',
        sourceContentDigest: CURRENT_DIGEST,
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
        graphName: 'klickeruzh:kb:kb-id:build-1',
        sourceContentDigest: 'digest-from-an-older-content-set',
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
        graphName: 'klickeruzh:kb:kb-id:build-1',
        sourceContentDigest: CURRENT_DIGEST,
      },
      latestBuild: { status: 'PROCESSING' },
      servingResources: SERVING,
    })

    await expect(getPublishedKnowledgeGraph(prisma, 'kb-id')).resolves.toEqual(
      expect.objectContaining({ buildId: 'build-1', isStale: false })
    )
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

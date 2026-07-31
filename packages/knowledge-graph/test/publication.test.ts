import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'

import {
  KnowledgeGraphNotPublishedError,
  getPublishedKnowledgeGraph,
} from '../src/publication.js'

function mockPrisma(graph: unknown): PrismaClient {
  return {
    chatbotKnowledgeGraph: {
      findUnique: vi.fn().mockResolvedValue(graph),
    },
  } as unknown as PrismaClient
}

describe('knowledge graph publication guard', () => {
  it('returns only published server context and source metadata', async () => {
    const prisma = mockPrisma({
      status: 'READY',
      selectionRevision: 3,
      builtRevision: 3,
      resources: [
        { id: 'resource-b', title: 'Second' },
        { id: 'resource-a', title: 'First' },
      ],
    })

    await expect(
      getPublishedKnowledgeGraph(prisma, 'chatbot-id')
    ).resolves.toEqual({
      chatbotId: 'chatbot-id',
      builtRevision: 3,
      graphName: 'klickeruzh:chatbot-id',
      sources: [
        { resourceId: 'resource-b', title: 'Second' },
        { resourceId: 'resource-a', title: 'First' },
      ],
    })
  })

  it.each([
    ['missing', null, 'EMPTY'],
    [
      'empty',
      {
        status: 'EMPTY',
        selectionRevision: 0,
        builtRevision: null,
        resources: [],
      },
      'EMPTY',
    ],
    [
      'dirty',
      {
        status: 'DIRTY',
        selectionRevision: 2,
        builtRevision: 1,
        resources: [{ id: 'resource-a', title: 'First' }],
      },
      'DIRTY',
    ],
    [
      'processing',
      {
        status: 'PROCESSING',
        selectionRevision: 2,
        builtRevision: 1,
        resources: [{ id: 'resource-a', title: 'First' }],
      },
      'PROCESSING',
    ],
    [
      'failed',
      {
        status: 'FAILED',
        selectionRevision: 2,
        builtRevision: 1,
        resources: [{ id: 'resource-a', title: 'First' }],
      },
      'FAILED',
    ],
    [
      'ready but stale',
      {
        status: 'READY',
        selectionRevision: 2,
        builtRevision: 1,
        resources: [{ id: 'resource-a', title: 'First' }],
      },
      'DIRTY',
    ],
    [
      'ready but no resources',
      {
        status: 'READY',
        selectionRevision: 1,
        builtRevision: 1,
        resources: [],
      },
      'EMPTY',
    ],
  ])('rejects an unpublished %s graph', async (_, graph, code) => {
    const promise = getPublishedKnowledgeGraph(mockPrisma(graph), 'chatbot-id')

    await expect(promise).rejects.toBeInstanceOf(
      KnowledgeGraphNotPublishedError
    )
    await expect(promise).rejects.toMatchObject({ code })
  })
})

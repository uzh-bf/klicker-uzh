import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'

import {
  computeKBContentDigest,
  hashKBContentDigestEntries,
} from '../src/digest.js'

function mockPrisma(
  resources: { id: string; activeContentSha256: string | null }[]
) {
  const findMany = vi.fn().mockResolvedValue(resources)
  return {
    prisma: { kBResource: { findMany } } as unknown as PrismaClient,
    findMany,
  }
}

describe('KB content digest', () => {
  it('covers only the resources that are actually serving', async () => {
    const { prisma, findMany } = mockPrisma([])

    await computeKBContentDigest(prisma, 'kb-id')

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          kbId: 'kb-id',
          deletedAt: null,
          status: 'READY',
          activeContentSha256: { not: null },
        },
        orderBy: { id: 'asc' },
      })
    )
  })

  it('changes when a resource is added, removed, or re-ingested', () => {
    const base = hashKBContentDigestEntries([
      { resourceId: 'a', contentSha256: 'sha-a' },
      { resourceId: 'b', contentSha256: 'sha-b' },
    ])

    expect(
      hashKBContentDigestEntries([
        { resourceId: 'a', contentSha256: 'sha-a' },
        { resourceId: 'b', contentSha256: 'sha-b' },
      ])
    ).toBe(base)

    // a resource re-ingested with new content
    expect(
      hashKBContentDigestEntries([
        { resourceId: 'a', contentSha256: 'sha-a' },
        { resourceId: 'b', contentSha256: 'sha-b-v2' },
      ])
    ).not.toBe(base)

    // a resource removed from the serving set
    expect(
      hashKBContentDigestEntries([{ resourceId: 'a', contentSha256: 'sha-a' }])
    ).not.toBe(base)

    // a resource added to the serving set
    expect(
      hashKBContentDigestEntries([
        { resourceId: 'a', contentSha256: 'sha-a' },
        { resourceId: 'b', contentSha256: 'sha-b' },
        { resourceId: 'c', contentSha256: 'sha-c' },
      ])
    ).not.toBe(base)
  })

  it('does not let concatenation alias across entry boundaries', () => {
    expect(
      hashKBContentDigestEntries([{ resourceId: 'a', contentSha256: 'b:c' }])
    ).not.toBe(
      hashKBContentDigestEntries([
        { resourceId: 'a', contentSha256: 'b' },
        { resourceId: 'c', contentSha256: '' },
      ])
    )
  })

  it('skips resources ingestion has not published content for', async () => {
    const { prisma } = mockPrisma([
      { id: 'a', activeContentSha256: 'sha-a' },
      { id: 'b', activeContentSha256: null },
    ])

    await expect(computeKBContentDigest(prisma, 'kb-id')).resolves.toBe(
      hashKBContentDigestEntries([{ resourceId: 'a', contentSha256: 'sha-a' }])
    )
  })
})

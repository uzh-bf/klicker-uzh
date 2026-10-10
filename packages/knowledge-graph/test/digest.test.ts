import {
  KBResourceMaterialType,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'

import {
  computeKBContentDigest,
  hashKBCanonicalInputReferences,
  hashKBContentDigestEntries,
} from '../src/digest.js'

function mockPrisma(
  resources: {
    id: string
    activeContentSha256: string | null
    status?: 'PROCESSING'
  }[]
) {
  const findMany = vi.fn().mockResolvedValue(resources)
  return {
    prisma: { kBResource: { findMany } } as unknown as PrismaClient,
    findMany,
  }
}

describe('KB content digest', () => {
  it('covers every course-content resource that has active serving content', async () => {
    const { prisma, findMany } = mockPrisma([])

    await computeKBContentDigest(prisma, 'kb-id')

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          kbId: 'kb-id',
          deletedAt: null,
          activeContentSha256: { not: null },
          materialType: KBResourceMaterialType.COURSE_CONTENT,
        },
        orderBy: { id: 'asc' },
      })
    )
  })

  it('keeps a serving revision in the digest while its replacement is processing', async () => {
    const { prisma } = mockPrisma([
      {
        id: 'resource-a',
        activeContentSha256: 'sha-a',
        status: 'PROCESSING',
      },
    ])

    await expect(computeKBContentDigest(prisma, 'kb-id')).resolves.toBe(
      hashKBContentDigestEntries([
        { resourceId: 'resource-a', contentSha256: 'sha-a' },
      ])
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

describe('canonical graph source lineage', () => {
  const reference = {
    contract_version: 'canonical-document/v1' as const,
    producer_id: 'klicker',
    project_id: 'project',
    kb_id: 'kb-id',
    external_resource_id: 'resource-a',
    resource_version: 1,
    source_sha256: 'a'.repeat(64),
    canonical_sha256: 'b'.repeat(64),
    parser_recipe_sha256: 'c'.repeat(64),
    byte_count: 100,
  }

  it('changes identity when parsing changes despite identical original bytes', () => {
    expect(
      hashKBCanonicalInputReferences([
        { ...reference, parser_recipe_sha256: 'd'.repeat(64) },
      ])
    ).not.toBe(hashKBCanonicalInputReferences([reference]))
    expect(() =>
      hashKBCanonicalInputReferences([reference, reference])
    ).toThrow()
  })
})

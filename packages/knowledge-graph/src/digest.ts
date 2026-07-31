import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'

export type KBContentDigestEntry = {
  resourceId: string
  contentSha256: string
}

/**
 * The KB's content identity: every resource currently serving RAG, pinned by the
 * content hash ingestion last published for it. A graph build is made from exactly
 * this set, so comparing digests answers "has the KB moved on since this build?".
 *
 * Computed on demand rather than materialized on KB, so it can never drift from
 * the resources it describes.
 */
export async function readKBContentDigestEntries(
  prisma: PrismaClient,
  kbId: string
): Promise<KBContentDigestEntry[]> {
  const resources = await prisma.kBResource.findMany({
    where: {
      kbId,
      deletedAt: null,
      status: 'READY',
      activeContentSha256: { not: null },
    },
    select: { id: true, activeContentSha256: true },
    orderBy: { id: 'asc' },
  })

  return resources.flatMap((resource) =>
    resource.activeContentSha256 === null
      ? []
      : [
          {
            resourceId: resource.id,
            contentSha256: resource.activeContentSha256,
          },
        ]
  )
}

export function hashKBContentDigestEntries(
  entries: KBContentDigestEntry[]
): string {
  const hash = createHash('sha256')

  // Ordering is fixed by the caller's `orderBy` so the digest is reproducible;
  // the separators keep concatenation from aliasing across entry boundaries.
  for (const entry of entries) {
    hash.update(`${entry.resourceId}:${entry.contentSha256}\n`)
  }

  return hash.digest('hex')
}

export async function computeKBContentDigest(
  prisma: PrismaClient,
  kbId: string
): Promise<string> {
  return hashKBContentDigestEntries(
    await readKBContentDigestEntries(prisma, kbId)
  )
}

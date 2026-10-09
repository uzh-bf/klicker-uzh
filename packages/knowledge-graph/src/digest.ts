import { createHash } from 'node:crypto'
import {
  KBResourceMaterialType,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  type CanonicalInputReference,
  isCanonicalInputReference,
} from '@klicker-uzh/types'

type KBContentDigestPrisma = Pick<PrismaClient, 'kBResource'>

export type KBContentDigestEntry = {
  resourceId: string
  contentSha256: string
}

/**
 * The KB's content identity: every resource a graph build is made from, pinned by
 * the content hash ingestion last published for it. A graph build covers exactly
 * the course-content resources serving RAG, so comparing digests answers "has the
 * KB moved on since this build?".
 *
 * Computed on demand rather than materialized on KB, so it can never drift from
 * the resources it describes.
 */
export async function readKBContentDigestEntries(
  prisma: KBContentDigestPrisma,
  kbId: string
): Promise<KBContentDigestEntry[]> {
  const resources = await prisma.kBResource.findMany({
    where: {
      kbId,
      deletedAt: null,
      // `status` belongs to the newest ingestion operation. Its predecessor can
      // still be serving while that operation is queued or processing.
      activeContentSha256: { not: null },
      // A graph covers only lecturer-curated course material, so administrative
      // uploads must not count as the KB moving on. This filter mirrors the
      // build path; without it a re-uploaded syllabus reports the graph stale
      // while its content is unchanged.
      materialType: KBResourceMaterialType.COURSE_CONTENT,
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
  prisma: KBContentDigestPrisma,
  kbId: string
): Promise<string> {
  return hashKBContentDigestEntries(
    await readKBContentDigestEntries(prisma, kbId)
  )
}

export function hashKBCanonicalInputReferences(
  references: CanonicalInputReference[]
): string {
  const hash = createHash('sha256')
  const sorted = [...references].sort((a, b) =>
    a.external_resource_id < b.external_resource_id
      ? -1
      : a.external_resource_id > b.external_resource_id
        ? 1
        : 0
  )
  if (
    new Set(sorted.map((item) => item.external_resource_id)).size !==
    sorted.length
  ) {
    throw new Error('Canonical sources must not repeat a resource')
  }
  for (const reference of sorted) {
    if (!isCanonicalInputReference(reference))
      throw new Error('Invalid canonical source lineage')
    hash.update(
      JSON.stringify([
        reference.contract_version,
        reference.producer_id,
        reference.project_id,
        reference.kb_id,
        reference.external_resource_id,
        reference.resource_version,
        reference.source_sha256,
        reference.canonical_sha256,
        reference.parser_recipe_sha256,
        reference.byte_count,
      ]) + '\n'
    )
  }
  return hash.digest('hex')
}

export async function computeKBCanonicalInputDigest(
  prisma: KBContentDigestPrisma,
  kbId: string
): Promise<string | null> {
  const resources = await prisma.kBResource.findMany({
    where: {
      kbId,
      deletedAt: null,
      activeContentSha256: { not: null },
      materialType: KBResourceMaterialType.COURSE_CONTENT,
    },
    select: {
      id: true,
      activeResourceVersion: true,
      activeContentSha256: true,
      activeCanonicalInput: true,
      ingestionOperation: true,
    },
    orderBy: { id: 'asc' },
  })
  const references: CanonicalInputReference[] = []
  for (const resource of resources) {
    const reference = resource.activeCanonicalInput
    if (
      !isCanonicalInputReference(reference) ||
      reference.kb_id !== kbId ||
      reference.external_resource_id !== resource.id ||
      reference.source_sha256 !== resource.activeContentSha256 ||
      reference.resource_version !== resource.activeResourceVersion ||
      resource.ingestionOperation === 'DELETE'
    )
      return null
    references.push(reference)
  }
  return references.length > 0
    ? hashKBCanonicalInputReferences(references)
    : null
}

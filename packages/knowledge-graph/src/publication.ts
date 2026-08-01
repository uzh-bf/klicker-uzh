import type { PrismaClient } from '@klicker-uzh/prisma/client'

import { computeKBContentDigest } from './digest.js'

export type KnowledgeGraphSourceMetadata = {
  resourceId: string
  title: string
}

export type PublishedKnowledgeGraph = {
  kbId: string
  buildId: string
  graphName: string
  /**
   * The KB's content has moved on since this build was made. The build keeps
   * serving regardless — staleness is a label on the lecturer's views, never an
   * outage for students (ADR 0001).
   */
  isStale: boolean
  sources: KnowledgeGraphSourceMetadata[]
}

export type KnowledgeGraphPublicationCode =
  | 'EMPTY'
  | 'QUEUED'
  | 'PROCESSING'
  | 'FAILED'

export class KnowledgeGraphNotPublishedError extends Error {
  readonly code: KnowledgeGraphPublicationCode

  constructor(code: KnowledgeGraphPublicationCode) {
    super('Knowledge graph is not published')
    this.name = 'KnowledgeGraphNotPublishedError'
    this.code = code
  }
}

/**
 * Each build writes its own graph and the KB's published pointer moves to it once
 * the build completes, so a graph is never mutated while it is being served.
 */
export function getKnowledgeGraphName(kbId: string, buildId: string): string {
  return `klickeruzh:kb:${kbId}:${buildId}`
}

function unpublishedCode(
  latestBuild: { status: string } | null
): KnowledgeGraphPublicationCode {
  if (latestBuild === null) {
    return 'EMPTY'
  }

  if (latestBuild.status === 'QUEUED' || latestBuild.status === 'PROCESSING') {
    return latestBuild.status
  }

  if (latestBuild.status === 'FAILED') {
    return 'FAILED'
  }

  return 'EMPTY'
}

export async function getPublishedKnowledgeGraph(
  prisma: PrismaClient,
  kbId: string
): Promise<PublishedKnowledgeGraph> {
  const kb = await prisma.kB.findFirst({
    where: { id: kbId, deletedAt: null },
    select: {
      publishedGraphBuildId: true,
      resources: {
        where: { deletedAt: null },
        select: { id: true, title: true },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (kb === null || kb.publishedGraphBuildId === null) {
    const latestBuild =
      kb === null
        ? null
        : await prisma.kBGraphBuild.findFirst({
            where: { kbId },
            select: { status: true },
            orderBy: { createdAt: 'desc' },
          })

    throw new KnowledgeGraphNotPublishedError(unpublishedCode(latestBuild))
  }

  const build = await prisma.kBGraphBuild.findUnique({
    where: { id: kb.publishedGraphBuildId },
    select: {
      id: true,
      kbId: true,
      status: true,
      graphName: true,
      sourceContentDigest: true,
    },
  })

  // The pointer is deliberately not a database relation. Treat it as untrusted
  // state: only a completed build belonging to this KB can name a served graph.
  if (build === null || build.kbId !== kbId || build.status !== 'SUCCEEDED') {
    throw new KnowledgeGraphNotPublishedError('EMPTY')
  }

  return {
    kbId,
    buildId: build.id,
    graphName: build.graphName,
    isStale:
      build.sourceContentDigest !==
      (await computeKBContentDigest(prisma, kbId)),
    sources: kb.resources.map((resource) => ({
      resourceId: resource.id,
      title: resource.title,
    })),
  }
}

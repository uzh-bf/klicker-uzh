import {
  getPublishedKnowledgeGraph,
  KnowledgeGraphNotPublishedError,
} from '@klicker-uzh/knowledge-graph'
import type * as DB from '@klicker-uzh/prisma/client'
import type {
  KBGraphSourceSnapshot,
  QuestionGenerationArtifactRef,
} from '@klicker-uzh/types'
import { QUESTION_GENERATION_CAPABILITIES } from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import { assertManageAiEnabled } from '../lib/manageAiFeatureGate.js'
import { isElementGenerationGraphBundleReady } from './elementGenerationGraphReadiness.js'

export type QuestionGenerationGraphErrorCode =
  | 'KB_GRAPH_VERSION_NOT_ELIGIBLE'
  | 'KB_GRAPH_VERSION_NOT_FOUND'
  | 'KB_GRAPH_MANIFEST_INVALID'
  | 'KB_GRAPH_SOURCE_MISMATCH'
  | 'KB_NOT_FOUND'

export class QuestionGenerationGraphError extends Error {
  readonly code: QuestionGenerationGraphErrorCode

  constructor(code: QuestionGenerationGraphErrorCode, message: string) {
    super(message)
    this.name = 'QuestionGenerationGraphError'
    this.code = code
  }
}

export type QuestionGenerationGraph = {
  id: string
  kbId: string
  bundleSha256: string
  falkordbGraphName: string
  graphManifest: QuestionGenerationArtifactRef
  graphSha256: string
  manifestSchemaVersion: number
  sourceSnapshot: KBGraphSourceSnapshot
  storageName: string
  indexedAt: Date
  isStale: boolean
}

export type QuestionGenerationSource = {
  graphBuildId: string
  kbId: string
  kbName: string
  indexedAt: Date
  isStale: boolean
  sourceCount: number
  sources: Array<{
    resourceId: string
    title: string
    sourceFile: string
    pageCount: number | null
  }>
}

export type QuestionGenerationCapabilities = {
  itemTypes: Array<'SC' | 'MC' | 'KPRIM'>
  languages: Array<'de' | 'en'>
  bloomLevels: Array<
    'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate'
  >
  difficultyLevels: number[]
  requiresDesignReview: boolean
  requiresPlanReview: boolean
  supportsIndividualRegeneration: boolean
}

function graphError(
  code: QuestionGenerationGraphErrorCode,
  message: string
): QuestionGenerationGraphError {
  return new QuestionGenerationGraphError(code, message)
}

export function questionGenerationSourceSnapshot(
  sources: Array<{
    resourceId: string
    title: string
    contentSha256: string
    sourceUrl: string | null
    blobName: string | null
  }>
): KBGraphSourceSnapshot {
  return sources.map((source) => ({
    resourceId: source.resourceId,
    title: source.title,
    sourceFile: `${source.resourceId}.md`,
    contentSha256: source.contentSha256,
    // The native graph ledger pins content identity rather than ingestion
    // counters. This compatibility value is never used as graph identity.
    resourceVersion: 1,
    pageCount: null,
  }))
}

const nativeBuildSelect = {
  id: true,
  kbId: true,
  status: true,
  graphName: true,
  graphBundleContainerName: true,
  graphBundleBlobPrefix: true,
  graphBundleStorageName: true,
  graphBundleSha256: true,
  graphSha256: true,
  graphManifestSchemaVersion: true,
  graphManifestArtifact: true,
  finishedAt: true,
  createdAt: true,
  sources: {
    select: {
      resourceId: true,
      title: true,
      contentSha256: true,
      sourceUrl: true,
      blobName: true,
    },
    orderBy: { resourceId: 'asc' as const },
  },
} satisfies DB.Prisma.KBGraphBuildSelect

type NativeBuild = DB.Prisma.KBGraphBuildGetPayload<{
  select: typeof nativeBuildSelect
}>

function asGenerationGraph(
  build: NativeBuild,
  isStale: boolean
): QuestionGenerationGraph {
  if (!isElementGenerationGraphBundleReady(build)) {
    throw graphError(
      'KB_GRAPH_VERSION_NOT_ELIGIBLE',
      'Published knowledge graph does not have a generation bundle'
    )
  }

  return {
    id: build.id,
    kbId: build.kbId,
    bundleSha256: build.graphBundleSha256,
    falkordbGraphName: build.graphName,
    graphManifest: build.graphManifestArtifact,
    graphSha256: build.graphSha256,
    manifestSchemaVersion: build.graphManifestSchemaVersion,
    sourceSnapshot: questionGenerationSourceSnapshot(build.sources),
    storageName: build.graphBundleStorageName,
    indexedAt: build.finishedAt ?? build.createdAt,
    isStale,
  }
}

export async function assertQuestionGenerationPreviewAccess(
  ctx: ContextWithUser
): Promise<void> {
  await assertManageAiEnabled(ctx)
}

export async function assertQuestionGenerationGraphEligible(
  graphBuildId: string,
  ctx: ContextWithUser
): Promise<QuestionGenerationGraph> {
  await assertQuestionGenerationPreviewAccess(ctx)
  const build = await ctx.prisma.kBGraphBuild.findFirst({
    where: {
      id: graphBuildId,
      kb: { is: { ownerId: ctx.user.sub, deletedAt: null } },
    },
    select: nativeBuildSelect,
  })
  if (!build) {
    throw graphError(
      'KB_GRAPH_VERSION_NOT_FOUND',
      'Knowledge graph build not found'
    )
  }

  let published: Awaited<ReturnType<typeof getPublishedKnowledgeGraph>>
  try {
    published = await getPublishedKnowledgeGraph(ctx.prisma, build.kbId)
  } catch (error) {
    if (error instanceof KnowledgeGraphNotPublishedError) {
      throw graphError(
        'KB_GRAPH_VERSION_NOT_ELIGIBLE',
        'Knowledge graph build is no longer published'
      )
    }
    throw error
  }
  if (published.buildId !== build.id) {
    throw graphError(
      'KB_GRAPH_VERSION_NOT_ELIGIBLE',
      'Knowledge graph build is not the published build'
    )
  }
  return asGenerationGraph(build, published.isStale)
}

export async function getQuestionGenerationSources(
  ctx: ContextWithUser
): Promise<QuestionGenerationSource[]> {
  await assertQuestionGenerationPreviewAccess(ctx)
  const knowledgeBases = await ctx.prisma.kB.findMany({
    where: {
      ownerId: ctx.user.sub,
      deletedAt: null,
      publishedGraphBuildId: { not: null },
    },
    select: { id: true, name: true, publishedGraphBuildId: true },
    orderBy: { name: 'asc' },
  })

  const sources = await Promise.all(
    knowledgeBases.map(async (kb) => {
      if (!kb.publishedGraphBuildId) return null
      try {
        const graph = await assertQuestionGenerationGraphEligible(
          kb.publishedGraphBuildId,
          ctx
        )
        return {
          graphBuildId: graph.id,
          kbId: kb.id,
          kbName: kb.name,
          indexedAt: graph.indexedAt,
          isStale: graph.isStale,
          sourceCount: graph.sourceSnapshot.length,
          sources: graph.sourceSnapshot.map((source) => ({
            resourceId: source.resourceId,
            title: source.title,
            sourceFile: source.sourceFile,
            pageCount: source.pageCount,
          })),
        }
      } catch (error) {
        if (error instanceof QuestionGenerationGraphError) return null
        throw error
      }
    })
  )
  return sources.filter((source) => source !== null)
}

export async function getQuestionGenerationCapabilities(
  ctx: ContextWithUser
): Promise<QuestionGenerationCapabilities> {
  await assertQuestionGenerationPreviewAccess(ctx)
  return {
    itemTypes: [...QUESTION_GENERATION_CAPABILITIES.itemTypes],
    languages: [...QUESTION_GENERATION_CAPABILITIES.languages],
    bloomLevels: [...QUESTION_GENERATION_CAPABILITIES.bloomLevels],
    difficultyLevels: [...QUESTION_GENERATION_CAPABILITIES.difficultyLevels],
    requiresDesignReview: true,
    requiresPlanReview: true,
    supportsIndividualRegeneration: false,
  }
}

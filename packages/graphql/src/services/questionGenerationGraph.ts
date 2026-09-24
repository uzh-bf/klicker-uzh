import {
  getDefaultKBGraphDomainCatalog,
  getPublishedKnowledgeGraph,
  hashKBContentDigestEntries,
  KnowledgeGraphNotPublishedError,
  resolveKBGraphDomainSelection,
} from '@klicker-uzh/knowledge-graph'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  ElementGenerationLanguage,
  KBGraphSourceSnapshot,
  QuestionGenerationArtifactRef,
} from '@klicker-uzh/types'
import { QUESTION_GENERATION_CAPABILITIES } from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import { isFeatureFlagEnabledForAccount } from '../lib/featureFlags.js'
import { assertManageAiEnabled } from '../lib/manageAiFeatureGate.js'
import { isElementGenerationGraphBundleReady } from './elementGenerationGraphReadiness.js'
import {
  deriveKBQuestionPreparation,
  evaluateKBGraphSystemOwner,
  getKBGraphPreparationFingerprint,
  getKBGraphPreparationStatus,
  KB_GRAPH_PREPARATION_QUALITY_TIER,
  KB_GRAPH_SYSTEM_OWNER_SELECT,
  KB_QUESTION_PREPARATION_DELAYED_AFTER_MS,
  type KBGraphPreparationPendingReason,
  type KBQuestionPreparationState,
} from './knowledge.js'
import { getKBGraphCostConfiguration } from './knowledgeGraphCost.js'
import {
  deriveKBGraphPreparationPendingSince,
  type KBGraphPreparationCandidate,
  loadKBGraphPreparationCandidates,
} from './knowledgeGraphPreparation.js'
import { questionGenerationServiceError } from './questionGenerationErrors.js'

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
  language: ElementGenerationLanguage
  sourceSnapshot: KBGraphSourceSnapshot
  storageName: string
  indexedAt: Date
  isStale: boolean
}

/**
 * The published graph a generation request for one KB may pin, with the
 * summary the lecturer confirms. `fingerprint` is the preparation identity of
 * that build; together with the build id it is the source basis a request
 * must carry back.
 */
export type QuestionGenerationSourceBasis = {
  graphBuildId: string
  fingerprint: string
  language: ElementGenerationLanguage
  indexedAt: Date
  /** Serving material was added or updated after this graph was prepared. */
  recentChangesExcluded: boolean
  sourceCount: number
  sources: Array<{
    resourceId: string
    title: string
    sourceFile: string
    pageCount: number | null
  }>
}

export type QuestionGenerationSource = {
  kbId: string
  kbName: string
  preparationState: KBQuestionPreparationState
  preparationPendingReason: KBGraphPreparationPendingReason | null
  /** Null while no published graph is eligible for generation. */
  basis: QuestionGenerationSourceBasis | null
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
  domainPolicyLanguage: true,
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

function generationLanguage(
  domainPolicyLanguage: string | null
): ElementGenerationLanguage | null {
  return domainPolicyLanguage === null || domainPolicyLanguage === 'German'
    ? 'de'
    : domainPolicyLanguage === 'English'
      ? 'en'
      : null
}

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

  const language = generationLanguage(build.domainPolicyLanguage)
  if (language === null) {
    throw graphError(
      'KB_GRAPH_VERSION_NOT_ELIGIBLE',
      'Published knowledge graph has an unsupported generation language'
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
    language,
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

export type QuestionGenerationSourceInputs = {
  kb: { id: string; name: string }
  candidate: KBGraphPreparationCandidate
  /** The build the KB publishes, when the candidate found it valid. */
  publishedBuild: NativeBuild | null
  /** Queued, processing and failed course-content resources. */
  courseContent: { processing: number; failed: number }
  admission: {
    /**
     * AI entitlement, `kb-graph-builds`, the per-KB opt-in and the graph cost
     * configuration admit a new build.
     */
    buildAdmitted: boolean
    /** Scheduled preparation admits the owner. */
    automaticPreparationAdmitted: boolean
    domainCapabilityEnabled: boolean
  }
  now: Date
}

/**
 * Generation readiness and the eligible source basis of one KB. The basis is
 * the published graph while it still represents the KB's settings and every
 * source it was prepared from is still serving course content. Sources added
 * or updated since only mark the basis as excluding recent changes; a source
 * that was deleted, reclassified or stopped serving withdraws it, as does a
 * subject or language change or a graph question generation cannot use.
 */
export function resolveQuestionGenerationSource({
  kb,
  candidate,
  publishedBuild,
  courseContent,
  admission,
  now,
}: QuestionGenerationSourceInputs): QuestionGenerationSource {
  const resolution = admission.domainCapabilityEnabled
    ? resolveKBGraphDomainSelection(
        {
          domainPolicyId: candidate.domainPolicyId,
          domainPolicyVersion: candidate.domainPolicyVersion,
          language: candidate.domainPolicyLanguage,
        },
        { catalog: getDefaultKBGraphDomainCatalog(), capabilityEnabled: true }
      )
    : null
  const storedDomain = resolution?.ok ? resolution.selection : null
  const preparation = getKBGraphPreparationStatus({
    desired: {
      domainPolicyId: storedDomain?.domainPolicyId ?? null,
      domainPolicyVersion: storedDomain?.domainPolicyVersion ?? null,
      domainPolicyLanguage: storedDomain?.language ?? null,
      qualityTier: KB_GRAPH_PREPARATION_QUALITY_TIER,
      sourceContentDigest: hashKBContentDigestEntries(
        candidate.servingResources.map((resource) => ({
          resourceId: resource.id,
          contentSha256: resource.activeContentSha256,
        }))
      ),
    },
    published: candidate.published,
    domainSelectionAvailable: admission.domainCapabilityEnabled,
  })

  const published = candidate.published
  const language = publishedBuild
    ? generationLanguage(publishedBuild.domainPolicyLanguage)
    : null
  const usableBuild =
    published !== null &&
    isElementGenerationGraphBundleReady(publishedBuild) &&
    language !== null
      ? publishedBuild
      : null

  const readiness = deriveKBQuestionPreparation({
    buildAdmitted: admission.buildAdmitted,
    automaticPreparationAdmitted:
      admission.automaticPreparationAdmitted && storedDomain !== null,
    courseContent: {
      serving: candidate.servingResources.length,
      ...courseContent,
    },
    activeBuild:
      candidate.activeBuild?.status === DB.KBGraphBuildStatus.QUEUED ||
      candidate.activeBuild?.status === DB.KBGraphBuildStatus.PROCESSING
        ? { status: candidate.activeBuild.status }
        : null,
    publishedGraphReady: usableBuild !== null,
    preparation,
    pendingSinceAt:
      preparation.pending && preparation.reason
        ? deriveKBGraphPreparationPendingSince(
            candidate,
            preparation.reason,
            now
          )
        : null,
    now,
    delayedAfterMs: KB_QUESTION_PREPARATION_DELAYED_AFTER_MS,
  })

  const servingIds = new Set(
    candidate.servingResources.map((resource) => resource.id)
  )
  const basisEligible =
    usableBuild !== null &&
    language !== null &&
    published !== null &&
    preparation.reason !== 'SETTINGS_CHANGED' &&
    published.sources.every((source) => servingIds.has(source.resourceId))
  const snapshot = usableBuild
    ? questionGenerationSourceSnapshot(usableBuild.sources)
    : []

  return {
    kbId: kb.id,
    kbName: kb.name,
    preparationState: readiness.state,
    preparationPendingReason: readiness.pendingReason,
    basis: basisEligible
      ? {
          graphBuildId: usableBuild.id,
          fingerprint: getKBGraphPreparationFingerprint(published),
          language,
          indexedAt: usableBuild.finishedAt ?? usableBuild.createdAt,
          recentChangesExcluded: preparation.reason === 'SOURCES_CHANGED',
          sourceCount: snapshot.length,
          sources: snapshot.map((source) => ({
            resourceId: source.resourceId,
            title: source.title,
            sourceFile: source.sourceFile,
            pageCount: source.pageCount,
          })),
        }
      : null,
  }
}

function isKBGraphCostConfigured(): boolean {
  try {
    return getKBGraphCostConfiguration().ready
  } catch {
    return false
  }
}

/**
 * Readiness and source basis of every KB the actor owns, optionally narrowed
 * to one id. All reads are batched over the listed KBs.
 */
async function loadQuestionGenerationSources(
  ctx: ContextWithUser,
  filter: { id?: string } = {}
): Promise<QuestionGenerationSource[]> {
  const kbWhere = {
    ...filter,
    ownerId: ctx.user.sub,
    deletedAt: null,
  } satisfies DB.Prisma.KBWhereInput
  const [kbs, candidates, owner] = await Promise.all([
    ctx.prisma.kB.findMany({
      where: kbWhere,
      select: {
        id: true,
        name: true,
        knowledgeGraphEnabled: true,
        publishedGraphBuildId: true,
      },
      orderBy: { name: 'asc' },
    }),
    loadKBGraphPreparationCandidates(ctx.prisma, kbWhere),
    ctx.prisma.user.findUnique({
      where: { id: ctx.user.sub },
      select: KB_GRAPH_SYSTEM_OWNER_SELECT,
    }),
  ])
  if (kbs.length === 0) return []

  const kbIds = kbs.map((kb) => kb.id)
  const candidatesById = new Map(
    candidates.map((candidate) => [candidate.kbId, candidate])
  )
  const publishedIds = kbs.flatMap((kb) =>
    kb.publishedGraphBuildId && candidatesById.get(kb.id)?.published
      ? [kb.publishedGraphBuildId]
      : []
  )
  const [publishedBuilds, resourceStatuses] = await Promise.all([
    ctx.prisma.kBGraphBuild.findMany({
      where: { id: { in: publishedIds }, kbId: { in: kbIds } },
      select: nativeBuildSelect,
    }),
    ctx.prisma.kBResource.groupBy({
      by: ['kbId', 'status'],
      where: {
        kbId: { in: kbIds },
        deletedAt: null,
        materialType: DB.KBResourceMaterialType.COURSE_CONTENT,
        status: {
          in: [
            DB.KBResourceStatus.QUEUED,
            DB.KBResourceStatus.PROCESSING,
            DB.KBResourceStatus.FAILED,
          ],
        },
      },
      _count: { _all: true },
    }),
  ])
  const publishedById = new Map(
    publishedBuilds.map((build) => [build.id, build])
  )
  const courseContentByKb = new Map<
    string,
    { processing: number; failed: number }
  >()
  for (const row of resourceStatuses) {
    const counts = courseContentByKb.get(row.kbId) ?? {
      processing: 0,
      failed: 0,
    }
    if (row.status === DB.KBResourceStatus.FAILED) {
      counts.failed += row._count._all
    } else {
      counts.processing += row._count._all
    }
    courseContentByKb.set(row.kbId, counts)
  }

  const ownerAdmission = evaluateKBGraphSystemOwner(ctx.featureFlags, owner)
  const buildsAdmitted =
    owner !== null &&
    ownerAdmission.capability === 'enabled' &&
    isFeatureFlagEnabledForAccount(
      ctx.featureFlags,
      owner,
      'kb-graph-builds'
    ) &&
    isKBGraphCostConfigured()
  const now = new Date()

  return kbs.flatMap((kb) => {
    const candidate = candidatesById.get(kb.id)
    // A KB created between the two reads is listed on the next load.
    if (!candidate) return []
    const publishedBuild =
      (kb.publishedGraphBuildId &&
        publishedById.get(kb.publishedGraphBuildId)) ||
      null
    return [
      resolveQuestionGenerationSource({
        kb,
        candidate,
        publishedBuild:
          publishedBuild?.kbId === kb.id && candidate.published
            ? publishedBuild
            : null,
        courseContent: courseContentByKb.get(kb.id) ?? {
          processing: 0,
          failed: 0,
        },
        admission: {
          buildAdmitted: buildsAdmitted && kb.knowledgeGraphEnabled,
          automaticPreparationAdmitted: ownerAdmission.graphBuildsAdmitted,
          domainCapabilityEnabled: ownerAdmission.domainCapabilityEnabled,
        },
        now,
      }),
    ]
  })
}

export async function getQuestionGenerationSources(
  ctx: ContextWithUser
): Promise<QuestionGenerationSource[]> {
  await assertQuestionGenerationPreviewAccess(ctx)
  return loadQuestionGenerationSources(ctx)
}

/**
 * Revalidates the source basis a generation request was configured with. The
 * KB must still be owned by the actor and its eligible basis must still be
 * the expected build with the expected preparation identity; otherwise the
 * request is refused so the lecturer can review the refreshed basis, and a
 * newer graph is never substituted.
 */
export async function assertQuestionGenerationBasisCurrent(
  expected: { kbId: string; graphBuildId: string; basisFingerprint: string },
  ctx: ContextWithUser
): Promise<void> {
  await assertQuestionGenerationPreviewAccess(ctx)
  const [source] = await loadQuestionGenerationSources(ctx, {
    id: expected.kbId,
  })
  if (
    !source?.basis ||
    source.basis.graphBuildId !== expected.graphBuildId ||
    source.basis.fingerprint !== expected.basisFingerprint
  ) {
    throw questionGenerationServiceError(
      'KB_GRAPH_BASIS_CHANGED',
      'The prepared material of this knowledge base changed; review it before generating'
    )
  }
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

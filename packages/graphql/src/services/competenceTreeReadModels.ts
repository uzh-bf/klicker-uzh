import { mapLevelsToTheta } from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import {
  deriveAdaptiveItemParameters,
  getAdaptiveElementChoiceCount,
} from './adaptiveElementValidation.js'
import {
  type CompetenceTreeCatalogArgs,
  type CompetenceTreeCatalogOwnership,
  type CompetenceTreeCatalogPage,
  type CompetenceTreeDetail,
  type CompetenceTreeSummary,
} from './competenceTreeManagementTypes.js'
import {
  assertCompetenceTreeCourseAccess,
  competenceTreeServiceError,
  getAccessibleCompetenceTreeElement,
  getReadableCompetenceTreeCourseIds,
  readableCompetenceTreeWhere,
} from './competenceTreeRepository.js'
import { validateCompetenceTreeShape } from './competenceTrees.js'

const courseSelect = { id: true, name: true, displayName: true } as const
const LEGACY_CATALOG_LIMIT = 100
const CATALOG_PAGE_SIZE = 25
const MAX_CATALOG_PAGE_SIZE = 100
const MAX_CATALOG_SEARCH_LENGTH = 200
const MAX_CATALOG_COURSE_LINKS = 20

const summaryInclude = {
  courseLinks: {
    include: { course: { select: courseSelect } },
    orderBy: { createdAt: 'asc' as const },
    take: 20,
  },
  _count: {
    select: {
      courseLinks: true,
      levels: true,
      nodes: true,
      elementAssignments: true,
    },
  },
  adaptivePracticeQuizConfigs: {
    select: { practiceQuiz: { select: { status: true } } },
  },
} satisfies DB.Prisma.CompetenceTreeInclude

const catalogSummaryInclude = {
  courseLinks: {
    include: { course: { select: courseSelect } },
    orderBy: { createdAt: 'asc' as const },
    take: MAX_CATALOG_COURSE_LINKS,
  },
  _count: {
    select: {
      courseLinks: true,
      levels: true,
      nodes: true,
      elementAssignments: true,
      adaptivePracticeQuizConfigs: true,
    },
  },
} satisfies DB.Prisma.CompetenceTreeInclude

export const competenceTreeDetailInclude = {
  courseLinks: {
    include: { course: { select: courseSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
  levels: { orderBy: { order: 'asc' as const } },
  nodes: {
    orderBy: [
      { depth: 'asc' as const },
      { parentId: 'asc' as const },
      { order: 'asc' as const },
    ],
  },
  levelCoverages: true,
  elementAssignments: {
    include: {
      element: {
        select: { type: true, name: true, version: true, options: true },
      },
    },
  },
  adaptivePracticeQuizConfigs: {
    select: { id: true, practiceQuiz: { select: { status: true } } },
  },
} satisfies DB.Prisma.CompetenceTreeInclude

type SummaryRecord = DB.Prisma.CompetenceTreeGetPayload<{
  include: typeof summaryInclude
}>
type CatalogSummaryRecord = DB.Prisma.CompetenceTreeGetPayload<{
  include: typeof catalogSummaryInclude
}>
type DetailRecord = DB.Prisma.CompetenceTreeGetPayload<{
  include: typeof competenceTreeDetailInclude
}>
type CatalogCursor = { updatedAt: Date; displayName: string; id: string }
type CatalogUsage = {
  draftByTreeId: Map<string, number>
  publishedByTreeId: Map<string, number>
}

export async function getCompetenceTrees(
  { includeArchived = false }: { includeArchived?: boolean | null },
  ctx: ContextWithUser
): Promise<CompetenceTreeSummary[]> {
  const [trees, readableCourseIds] = await Promise.all([
    ctx.prisma.competenceTree.findMany({
      where: readableCompetenceTreeWhere(
        ctx.user.sub,
        includeArchived ?? false
      ),
      include: summaryInclude,
      orderBy: [{ updatedAt: 'desc' }, { displayName: 'asc' }],
      take: LEGACY_CATALOG_LIMIT,
    }),
    getReadableCompetenceTreeCourseIds(ctx),
  ])
  return trees.map((tree) => toSummary(tree, ctx.user.sub, readableCourseIds))
}

export async function getCompetenceTreeCatalog(
  args: CompetenceTreeCatalogArgs,
  ctx: ContextWithUser
): Promise<CompetenceTreeCatalogPage> {
  if (args.courseId) {
    await assertCompetenceTreeCourseAccess(
      args.courseId,
      DB.PermissionLevel.READ,
      ctx
    )
  }
  if (args.excludeCourseId) {
    await assertCompetenceTreeCourseAccess(
      args.excludeCourseId,
      DB.PermissionLevel.READ,
      ctx
    )
  }
  return await getCatalogPage(
    {
      ...args,
      where: {
        AND: [
          readableCompetenceTreeWhere(
            ctx.user.sub,
            args.includeArchived ?? false
          ),
          ownershipWhere(args.ownership ?? 'ALL', ctx.user.sub),
          ...(args.courseId
            ? [{ courseLinks: { some: { courseId: args.courseId } } }]
            : []),
          ...(args.excludeCourseId
            ? [{ courseLinks: { none: { courseId: args.excludeCourseId } } }]
            : []),
        ],
      },
    },
    ctx
  )
}

export async function getCourseCompetenceTrees(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
): Promise<CompetenceTreeSummary[]> {
  await assertCompetenceTreeCourseAccess(courseId, DB.PermissionLevel.READ, ctx)
  const trees = await ctx.prisma.competenceTree.findMany({
    where: {
      isDeleted: false,
      isArchived: false,
      courseLinks: { some: { courseId } },
    },
    include: summaryInclude,
    orderBy: { displayName: 'asc' },
    take: LEGACY_CATALOG_LIMIT,
  })
  return trees.map((tree) => toSummary(tree, ctx.user.sub, new Set([courseId])))
}

export async function getCourseCompetenceTreeCatalog(
  {
    courseId,
    search,
    cursor,
    limit,
  }: {
    courseId: string
    search?: string | null
    cursor?: string | null
    limit?: number | null
  },
  ctx: ContextWithUser
): Promise<CompetenceTreeCatalogPage> {
  await assertCompetenceTreeCourseAccess(courseId, DB.PermissionLevel.READ, ctx)
  return await getCatalogPage(
    {
      search,
      cursor,
      limit,
      where: {
        isDeleted: false,
        isArchived: false,
        courseLinks: { some: { courseId } },
      },
    },
    ctx
  )
}

export async function getCompetenceTree(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<CompetenceTreeDetail | null> {
  const [tree, readableCourseIds] = await Promise.all([
    ctx.prisma.competenceTree.findFirst({
      where: { id, ...readableCompetenceTreeWhere(ctx.user.sub, true) },
      include: competenceTreeDetailInclude,
    }),
    getReadableCompetenceTreeCourseIds(ctx),
  ])
  return tree ? toDetail(tree, ctx.user.sub, readableCourseIds) : null
}

export async function getRequiredCompetenceTree(
  id: string,
  ctx: ContextWithUser
): Promise<CompetenceTreeDetail> {
  const tree = await getCompetenceTree({ id }, ctx)
  if (!tree) {
    throw competenceTreeServiceError('Competence tree not found.', 'NOT_FOUND')
  }
  return tree
}

export async function getElementCompetenceTrees(
  { elementId }: { elementId: number },
  ctx: ContextWithUser
): Promise<CompetenceTreeDetail[]> {
  await getAccessibleCompetenceTreeElement(elementId, ctx.user.sub, ctx.prisma)
  const [trees, readableCourseIds] = await Promise.all([
    ctx.prisma.competenceTree.findMany({
      where: {
        ...readableCompetenceTreeWhere(ctx.user.sub, true),
        elementAssignments: { some: { elementId } },
      },
      include: competenceTreeDetailInclude,
      orderBy: [{ updatedAt: 'desc' }, { displayName: 'asc' }],
    }),
    getReadableCompetenceTreeCourseIds(ctx),
  ])
  return trees.map((tree) => toDetail(tree, ctx.user.sub, readableCourseIds))
}

async function getCatalogPage(
  {
    where,
    search,
    cursor,
    limit,
  }: Pick<CompetenceTreeCatalogArgs, 'search' | 'cursor' | 'limit'> & {
    where: DB.Prisma.CompetenceTreeWhereInput
  },
  ctx: ContextWithUser
): Promise<CompetenceTreeCatalogPage> {
  const pageSize = normalizeCatalogLimit(limit)
  const normalizedSearch = normalizeCatalogSearch(search)
  const decodedCursor = cursor ? decodeCatalogCursor(cursor) : null
  const trees = await ctx.prisma.competenceTree.findMany({
    where: {
      AND: [
        where,
        catalogSearchWhere(normalizedSearch),
        ...(decodedCursor ? [catalogCursorWhere(decodedCursor)] : []),
      ],
    },
    include: catalogSummaryInclude,
    orderBy: [{ updatedAt: 'desc' }, { displayName: 'asc' }, { id: 'asc' }],
    take: pageSize + 1,
  })
  const hasNextPage = trees.length > pageSize
  const pageTrees = hasNextPage ? trees.slice(0, pageSize) : trees
  const treeIds = pageTrees.map(({ id }) => id)
  const courseIds = Array.from(
    new Set(
      pageTrees.flatMap((tree) => tree.courseLinks.map((link) => link.courseId))
    )
  )
  const [usage, readableCourseIds] = await Promise.all([
    getCatalogUsage(treeIds, ctx),
    getReadableCompetenceTreeCourseIds(ctx, courseIds),
  ])
  return {
    items: pageTrees.map((tree) =>
      toCatalogSummary(tree, ctx.user.sub, readableCourseIds, usage)
    ),
    nextCursor:
      hasNextPage && pageTrees.length > 0
        ? encodeCatalogCursor(pageTrees[pageTrees.length - 1]!)
        : null,
  }
}

function ownershipWhere(
  ownership: CompetenceTreeCatalogOwnership,
  userId: string
): DB.Prisma.CompetenceTreeWhereInput {
  if (ownership === 'OWNED') return { ownerId: userId }
  if (ownership === 'LINKED') return { ownerId: { not: userId } }
  return {}
}

function catalogSearchWhere(
  search: string | null
): DB.Prisma.CompetenceTreeWhereInput {
  if (!search) return {}
  const contains = { contains: search, mode: 'insensitive' as const }
  return {
    OR: [
      { name: contains },
      { displayName: contains },
      { description: contains },
      {
        courseLinks: {
          some: {
            course: { OR: [{ name: contains }, { displayName: contains }] },
          },
        },
      },
    ],
  }
}

function catalogCursorWhere(
  cursor: CatalogCursor
): DB.Prisma.CompetenceTreeWhereInput {
  return {
    OR: [
      { updatedAt: { lt: cursor.updatedAt } },
      { updatedAt: cursor.updatedAt, displayName: { gt: cursor.displayName } },
      {
        updatedAt: cursor.updatedAt,
        displayName: cursor.displayName,
        id: { gt: cursor.id },
      },
    ],
  }
}

function normalizeCatalogLimit(limit?: number | null): number {
  if (limit == null) return CATALOG_PAGE_SIZE
  if (!Number.isInteger(limit) || limit < 1) {
    throw competenceTreeServiceError(
      'Catalog limit must be a positive integer.',
      'BAD_USER_INPUT'
    )
  }
  return Math.min(limit, MAX_CATALOG_PAGE_SIZE)
}

function normalizeCatalogSearch(search?: string | null): string | null {
  const normalized = search?.trim() ?? ''
  if (!normalized) return null
  if (normalized.length > MAX_CATALOG_SEARCH_LENGTH) {
    throw competenceTreeServiceError(
      `Catalog search must not exceed ${MAX_CATALOG_SEARCH_LENGTH} characters.`,
      'BAD_USER_INPUT'
    )
  }
  return normalized
}

function encodeCatalogCursor(
  tree: Pick<DB.CompetenceTree, 'updatedAt' | 'displayName' | 'id'>
): string {
  return Buffer.from(
    JSON.stringify({
      updatedAt: tree.updatedAt.toISOString(),
      displayName: tree.displayName,
      id: tree.id,
    })
  ).toString('base64url')
}

function decodeCatalogCursor(value: string): CatalogCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as Record<string, unknown>
    const updatedAt = new Date(String(parsed.updatedAt ?? ''))
    if (
      Number.isNaN(updatedAt.getTime()) ||
      typeof parsed.displayName !== 'string' ||
      typeof parsed.id !== 'string'
    ) {
      throw new Error('invalid cursor payload')
    }
    return { updatedAt, displayName: parsed.displayName, id: parsed.id }
  } catch {
    throw competenceTreeServiceError(
      'Catalog cursor is invalid.',
      'BAD_USER_INPUT'
    )
  }
}

async function getCatalogUsage(
  treeIds: string[],
  ctx: ContextWithUser
): Promise<CatalogUsage> {
  if (treeIds.length === 0) {
    return { draftByTreeId: new Map(), publishedByTreeId: new Map() }
  }
  const countByStatus = async (status: DB.PublicationStatus) =>
    await ctx.prisma.competenceTree.findMany({
      where: { id: { in: treeIds } },
      select: {
        id: true,
        _count: {
          select: {
            adaptivePracticeQuizConfigs: {
              where: { practiceQuiz: { status } },
            },
          },
        },
      },
    })
  const [draft, published] = await Promise.all([
    countByStatus(DB.PublicationStatus.DRAFT),
    countByStatus(DB.PublicationStatus.PUBLISHED),
  ])
  return {
    draftByTreeId: new Map(
      draft.map((tree) => [tree.id, tree._count.adaptivePracticeQuizConfigs])
    ),
    publishedByTreeId: new Map(
      published.map((tree) => [
        tree.id,
        tree._count.adaptivePracticeQuizConfigs,
      ])
    ),
  }
}

function toSummary(
  tree: SummaryRecord,
  userId: string,
  readableCourseIds: Set<string>
): CompetenceTreeSummary {
  const { _count, adaptivePracticeQuizConfigs, ...data } = tree
  const isOwner = tree.ownerId === userId
  const usage = getAdaptiveQuizUsage(adaptivePracticeQuizConfigs)
  const courseLinks = getVisibleCourseLinks(
    tree.courseLinks,
    isOwner,
    readableCourseIds
  )
  return {
    ...data,
    courseLinks,
    courseLinkCount: isOwner ? _count.courseLinks : courseLinks.length,
    levelCount: _count.levels,
    nodeCount: _count.nodes,
    assignmentCount: _count.elementAssignments,
    ...usage,
    isArchived: tree.isArchived,
    isOwner,
    canEdit: isOwner,
    isStructurallyLocked: usage.adaptiveQuizCount > 0,
  }
}

function toCatalogSummary(
  tree: CatalogSummaryRecord,
  userId: string,
  readableCourseIds: Set<string>,
  usage: CatalogUsage
): CompetenceTreeSummary {
  const { _count, ...data } = tree
  const isOwner = tree.ownerId === userId
  const draftAdaptiveQuizCount = usage.draftByTreeId.get(tree.id) ?? 0
  const publishedAdaptiveQuizCount = usage.publishedByTreeId.get(tree.id) ?? 0
  const courseLinks = getVisibleCourseLinks(
    tree.courseLinks,
    isOwner,
    readableCourseIds
  )
  return {
    ...data,
    courseLinks,
    courseLinkCount: isOwner ? _count.courseLinks : courseLinks.length,
    levelCount: _count.levels,
    nodeCount: _count.nodes,
    assignmentCount: _count.elementAssignments,
    adaptiveQuizCount: _count.adaptivePracticeQuizConfigs,
    draftAdaptiveQuizCount,
    publishedAdaptiveQuizCount,
    isArchived: tree.isArchived,
    isOwner,
    canEdit: isOwner,
    isStructurallyLocked: _count.adaptivePracticeQuizConfigs > 0,
  }
}

function toDetail(
  tree: DetailRecord,
  userId: string,
  readableCourseIds: Set<string>
): CompetenceTreeDetail {
  const validation = validateCompetenceTreeShape({
    name: tree.name,
    displayName: tree.displayName,
    maxDepth: tree.maxDepth,
    thetaMin: tree.thetaMin,
    thetaMax: tree.thetaMax,
    defaultDiscrimination: tree.defaultDiscrimination,
    levels: tree.levels,
    nodes: tree.nodes,
    coverages: tree.levelCoverages,
    assignments: tree.elementAssignments.map((assignment) => ({
      elementId: assignment.elementId,
      type: assignment.element.type,
      leafNodeId: assignment.leafNodeId,
      levelId: assignment.levelId,
      discrimination: assignment.discrimination,
      enablePercentInput: assignment.enablePercentInput,
      enabled: assignment.enabled,
    })),
  })
  if (!validation.valid) {
    throw new GraphQLError('Stored competence tree is invalid.', {
      extensions: {
        code: 'COMPETENCE_TREE_DATA_INVALID',
        issues: validation.errors,
      },
    })
  }
  const mappedLevels = mapLevelsToTheta(
    tree.levels,
    { min: tree.thetaMin, max: tree.thetaMax },
    tree.levelMappingRule
  )
  const mappedLevelsById = new Map(
    tree.levels.map((level, index) => [level.id, mappedLevels[index]!])
  )
  const levels = tree.levels.map((level) => ({
    ...level,
    ...mappedLevelsById.get(level.id)!,
  }))
  const elementAssignments = tree.elementAssignments.map((assignment) => {
    const choiceCount = getAdaptiveElementChoiceCount(
      assignment.element.options
    )
    const levelTheta = mappedLevelsById.get(assignment.levelId)!.theta
    const parameters = deriveAdaptiveItemParameters({
      type: assignment.element.type,
      choiceCount,
      levelTheta,
      discrimination: assignment.discrimination ?? tree.defaultDiscrimination,
    })
    const { element, ...data } = assignment
    return {
      ...data,
      elementType: element.type,
      elementName: element.name,
      elementVersion: element.version,
      choiceCount,
      ...parameters,
    }
  })
  const {
    adaptivePracticeQuizConfigs,
    elementAssignments: _assignments,
    ...data
  } = tree
  const isOwner = tree.ownerId === userId
  const usage = getAdaptiveQuizUsage(adaptivePracticeQuizConfigs)
  const courseLinks = getVisibleCourseLinks(
    tree.courseLinks,
    isOwner,
    readableCourseIds
  )
  return {
    ...data,
    courseLinks,
    courseLinkCount: courseLinks.length,
    levels,
    elementAssignments,
    levelCount: levels.length,
    nodeCount: tree.nodes.length,
    assignmentCount: elementAssignments.length,
    ...usage,
    isArchived: tree.isArchived,
    isOwner,
    canEdit: isOwner,
    isStructurallyLocked: usage.adaptiveQuizCount > 0,
    validation,
  }
}

function getVisibleCourseLinks<T extends { courseId: string }>(
  courseLinks: T[],
  isOwner: boolean,
  readableCourseIds: Set<string>
): T[] {
  return isOwner
    ? courseLinks
    : courseLinks.filter(({ courseId }) => readableCourseIds.has(courseId))
}

function getAdaptiveQuizUsage(
  configs: Array<{ practiceQuiz: Pick<DB.PracticeQuiz, 'status'> }>
) {
  return {
    adaptiveQuizCount: configs.length,
    draftAdaptiveQuizCount: configs.filter(
      ({ practiceQuiz }) => practiceQuiz.status === DB.PublicationStatus.DRAFT
    ).length,
    publishedAdaptiveQuizCount: configs.filter(
      ({ practiceQuiz }) =>
        practiceQuiz.status === DB.PublicationStatus.PUBLISHED
    ).length,
  }
}

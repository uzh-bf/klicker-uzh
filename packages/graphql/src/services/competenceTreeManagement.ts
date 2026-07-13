import { mapLevelsToTheta } from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import {
  assertValidTree,
  getAccessibleElements,
  normalizeEditableMetadata,
  normalizeTreeMetadata,
  persistTreeStructure,
  prepareTreeInput,
  validatePreparedTree,
  type CompetenceTreeInput,
  type CompetenceTreeMetadataInput,
  type DuplicateCompetenceTreeInput,
} from './competenceTreeInput.js'
import {
  deriveAdaptiveItemParameters,
  hasControlledAdaptiveAnswer,
  validateCompetenceTreeShape,
  type CompetenceTreeValidationResult,
} from './competenceTrees.js'

export type {
  CompetenceTreeAssignmentInput,
  CompetenceTreeCoverageInput,
  CompetenceTreeInput,
  CompetenceTreeLevelInput,
  CompetenceTreeMetadataInput,
  CompetenceTreeNodeInput,
  DuplicateCompetenceTreeInput,
} from './competenceTreeInput.js'

export type CompetenceTreeCourseView = DB.CompetenceTreeCourse & {
  course: Pick<DB.Course, 'id' | 'name' | 'displayName'>
}

export type CompetenceTreeSummary = DB.CompetenceTree & {
  courseLinks: CompetenceTreeCourseView[]
  levelCount: number
  nodeCount: number
  assignmentCount: number
  adaptiveQuizCount: number
  draftAdaptiveQuizCount: number
  publishedAdaptiveQuizCount: number
  isArchived: boolean
  isOwner: boolean
  canEdit: boolean
  isStructurallyLocked: boolean
}

export type CompetenceTreeElementAssignmentUpdateInput = {
  leafNodeId: number
  levelId: number
  enabled: boolean
  enablePercentInput: boolean
  discrimination?: number | null
}

export type CompetenceTreeLevelView = DB.CompetenceTreeLevel & {
  theta: number
  lowerBound: number
  upperBound: number
}

export type CompetenceTreeAssignmentView =
  DB.CompetenceTreeElementAssignment & {
    elementType: DB.ElementType
    elementName: string
    elementVersion: number
    choiceCount: number | null
    a: number
    b: number
    c: number
  }

export type CompetenceTreeDetail = CompetenceTreeSummary & {
  levels: CompetenceTreeLevelView[]
  nodes: DB.CompetenceTreeNode[]
  levelCoverages: DB.CompetenceTreeLeafLevelCoverage[]
  elementAssignments: CompetenceTreeAssignmentView[]
  validation: CompetenceTreeValidationResult
}

const courseSelect = {
  id: true,
  name: true,
  displayName: true,
} as const

const summaryInclude = {
  courseLinks: {
    include: { course: { select: courseSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: {
    select: {
      levels: true,
      nodes: true,
      elementAssignments: true,
    },
  },
  adaptivePracticeQuizConfigs: {
    select: { practiceQuiz: { select: { status: true } } },
  },
} satisfies DB.Prisma.CompetenceTreeInclude

const detailInclude = {
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
        select: {
          type: true,
          name: true,
          version: true,
          options: true,
        },
      },
    },
  },
  adaptivePracticeQuizConfigs: {
    select: {
      id: true,
      practiceQuiz: { select: { status: true } },
    },
  },
} satisfies DB.Prisma.CompetenceTreeInclude

type SummaryRecord = DB.Prisma.CompetenceTreeGetPayload<{
  include: typeof summaryInclude
}>

type DetailRecord = DB.Prisma.CompetenceTreeGetPayload<{
  include: typeof detailInclude
}>

export async function getCompetenceTrees(
  { includeArchived = false }: { includeArchived?: boolean | null },
  ctx: ContextWithUser
): Promise<CompetenceTreeSummary[]> {
  const [trees, readableCourseIds] = await Promise.all([
    ctx.prisma.competenceTree.findMany({
      where: readableTreeWhere(ctx.user.sub, includeArchived ?? false),
      include: summaryInclude,
      orderBy: [{ updatedAt: 'desc' }, { displayName: 'asc' }],
    }),
    getReadableCourseIds(ctx),
  ])

  return trees.map((tree) => toSummary(tree, ctx.user.sub, readableCourseIds))
}

export async function getCourseCompetenceTrees(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
): Promise<CompetenceTreeSummary[]> {
  await assertCourseAccess(courseId, DB.PermissionLevel.READ, ctx)

  const trees = await ctx.prisma.competenceTree.findMany({
    where: {
      isDeleted: false,
      isArchived: false,
      courseLinks: { some: { courseId } },
    },
    include: summaryInclude,
    orderBy: { displayName: 'asc' },
  })

  const readableCourseIds = new Set([courseId])
  return trees.map((tree) => toSummary(tree, ctx.user.sub, readableCourseIds))
}

export async function getCompetenceTree(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<CompetenceTreeDetail | null> {
  const [tree, readableCourseIds] = await Promise.all([
    ctx.prisma.competenceTree.findFirst({
      where: { id, ...readableTreeWhere(ctx.user.sub, true) },
      include: detailInclude,
    }),
    getReadableCourseIds(ctx),
  ])

  return tree ? toDetail(tree, ctx.user.sub, readableCourseIds) : null
}

export async function getElementCompetenceTrees(
  { elementId }: { elementId: number },
  ctx: ContextWithUser
): Promise<CompetenceTreeDetail[]> {
  await getAccessibleElement(elementId, ctx.user.sub, ctx.prisma)

  const [trees, readableCourseIds] = await Promise.all([
    ctx.prisma.competenceTree.findMany({
      where: {
        ...readableTreeWhere(ctx.user.sub, true),
        elementAssignments: { some: { elementId } },
      },
      include: detailInclude,
      orderBy: [{ updatedAt: 'desc' }, { displayName: 'asc' }],
    }),
    getReadableCourseIds(ctx),
  ])

  return trees.map((tree) => toDetail(tree, ctx.user.sub, readableCourseIds))
}

export async function validateCompetenceTreeInput(
  { input }: { input: CompetenceTreeInput },
  ctx: ContextWithUser
): Promise<CompetenceTreeValidationResult> {
  const prepared = prepareTreeInput(input)
  const elements = await getAccessibleElements(prepared.assignments, ctx)
  return validatePreparedTree(prepared, elements)
}

export async function createCompetenceTree(
  { input }: { input: CompetenceTreeInput },
  ctx: ContextWithUser
): Promise<CompetenceTreeDetail> {
  const prepared = prepareTreeInput(input)
  const elements = await getAccessibleElements(prepared.assignments, ctx)
  assertValidTree(prepared, elements)
  const metadata = normalizeTreeMetadata(prepared)

  const treeId = await ctx.prisma.$transaction(async (tx) => {
    const tree = await tx.competenceTree.create({
      data: { ...metadata, ownerId: ctx.user.sub },
      select: { id: true },
    })
    await persistTreeStructure(tx, tree.id, prepared)
    return tree.id
  })

  return await getRequiredCompetenceTree(treeId, ctx)
}

export async function replaceCompetenceTree(
  { id, input }: { id: string; input: CompetenceTreeInput },
  ctx: ContextWithUser
): Promise<CompetenceTreeDetail> {
  await assertTreeOwner(id, ctx)

  const locked = await ctx.prisma.practiceQuizAdaptiveConfig.count({
    where: { competenceTreeId: id },
  })
  if (locked > 0) {
    throw serviceError(
      'This competence tree is already used by a practice quiz. Duplicate it before changing its structure.',
      'COMPETENCE_TREE_STRUCTURE_LOCKED'
    )
  }

  const prepared = prepareTreeInput(input)
  const elements = await getAccessibleElements(prepared.assignments, ctx)
  assertValidTree(prepared, elements)
  const metadata = normalizeTreeMetadata(prepared)

  await ctx.prisma.$transaction(async (tx) => {
    await lockOwnedCompetenceTree(tx, id, ctx.user.sub)
    const stillLocked = await tx.practiceQuizAdaptiveConfig.count({
      where: { competenceTreeId: id },
    })
    if (stillLocked > 0) {
      throw serviceError(
        'This competence tree is already used by a practice quiz.',
        'COMPETENCE_TREE_STRUCTURE_LOCKED'
      )
    }

    await tx.competenceTreeElementAssignment.deleteMany({
      where: { treeId: id },
    })
    await tx.competenceTreeLeafLevelCoverage.deleteMany({
      where: { treeId: id },
    })
    await tx.competenceTreeNode.deleteMany({ where: { treeId: id } })
    await tx.competenceTreeLevel.deleteMany({ where: { treeId: id } })
    await tx.competenceTree.update({
      where: { id, ownerId: ctx.user.sub },
      data: metadata,
    })
    await persistTreeStructure(tx, id, prepared)
  })

  return await getRequiredCompetenceTree(id, ctx)
}

export async function updateCompetenceTreeMetadata(
  { id, input }: { id: string; input: CompetenceTreeMetadataInput },
  ctx: ContextWithUser
): Promise<CompetenceTreeDetail> {
  const metadata = normalizeEditableMetadata(input)

  await ctx.prisma.$transaction(async (tx) => {
    await lockOwnedCompetenceTree(tx, id, ctx.user.sub)
    await tx.competenceTree.update({
      where: { id, ownerId: ctx.user.sub },
      data: metadata,
    })
  })

  return await getRequiredCompetenceTree(id, ctx)
}

export async function updateCompetenceTreeElementAssignment(
  {
    treeId,
    elementId,
    assignment,
  }: {
    treeId: string
    elementId: number
    assignment?: CompetenceTreeElementAssignmentUpdateInput | null
  },
  ctx: ContextWithUser
): Promise<CompetenceTreeDetail> {
  await ctx.prisma.$transaction(async (tx) => {
    await lockOwnedCompetenceTree(tx, treeId, ctx.user.sub)
    const locked = await tx.practiceQuizAdaptiveConfig.count({
      where: { competenceTreeId: treeId },
    })
    if (locked > 0) {
      throw serviceError(
        'This competence tree is already used by a practice quiz. Duplicate it before changing its assignments.',
        'COMPETENCE_TREE_STRUCTURE_LOCKED'
      )
    }

    if (!assignment) {
      await tx.competenceTreeElementAssignment.deleteMany({
        where: { treeId, elementId },
      })
      return
    }

    const [tree, element] = await Promise.all([
      tx.competenceTree.findUniqueOrThrow({
        where: { id: treeId },
        include: detailInclude,
      }),
      getAccessibleElement(elementId, ctx.user.sub, tx),
    ])
    const coverage = tree.levelCoverages.find(
      (entry) =>
        entry.leafNodeId === assignment.leafNodeId &&
        entry.levelId === assignment.levelId &&
        entry.enabled
    )
    if (!coverage) {
      throw serviceError(
        'Element assignments require enabled leaf-level coverage in the same competence tree.',
        'COMPETENCE_TREE_ASSIGNMENT_COVERAGE_INVALID'
      )
    }

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
      assignments: [
        ...tree.elementAssignments
          .filter((entry) => entry.elementId !== elementId)
          .map((entry) => ({
            elementId: entry.elementId,
            type: entry.element.type,
            leafNodeId: entry.leafNodeId,
            levelId: entry.levelId,
            discrimination: entry.discrimination,
            enablePercentInput: entry.enablePercentInput,
            enabled: entry.enabled,
            controlledAnswerReady: hasControlledAdaptiveAnswer(
              entry.element.type,
              entry.element.options
            ),
          })),
        {
          elementId,
          type: element.type,
          leafNodeId: assignment.leafNodeId,
          levelId: assignment.levelId,
          discrimination: assignment.discrimination,
          enablePercentInput: assignment.enablePercentInput,
          enabled: assignment.enabled,
          controlledAnswerReady: hasControlledAdaptiveAnswer(
            element.type,
            element.options
          ),
        },
      ],
    })
    if (!validation.valid) {
      throw new GraphQLError('Competence tree assignment is invalid.', {
        extensions: {
          code: 'COMPETENCE_TREE_INVALID',
          issues: validation.errors,
        },
      })
    }

    const assignmentData = {
      ...assignment,
      discrimination: assignment.discrimination ?? null,
    }
    await tx.competenceTreeElementAssignment.upsert({
      where: { treeId_elementId: { treeId, elementId } },
      create: { treeId, elementId, ...assignmentData },
      update: assignmentData,
    })
  })

  return await getRequiredCompetenceTree(treeId, ctx)
}

export async function duplicateCompetenceTree(
  {
    id,
    input,
  }: {
    id: string
    input?: DuplicateCompetenceTreeInput | null
  },
  ctx: ContextWithUser
): Promise<CompetenceTreeDetail> {
  const source = await getCompetenceTree({ id }, ctx)
  if (!source) throw serviceError('Competence tree not found.', 'NOT_FOUND')

  const levelKeys = new Map(
    source.levels.map((level) => [level.id, `level-${level.id}`])
  )
  const nodeKeys = new Map(
    source.nodes.map((node) => [node.id, `node-${node.id}`])
  )

  return await createCompetenceTree(
    {
      input: {
        name: input?.name?.trim() || `${source.name} copy`,
        displayName:
          input?.displayName?.trim() || `${source.displayName} (copy)`,
        description: source.description,
        maxDepth: source.maxDepth,
        thetaMin: source.thetaMin,
        thetaMax: source.thetaMax,
        defaultDiscrimination: source.defaultDiscrimination,
        levelMappingRule: source.levelMappingRule,
        levels: source.levels.map((level) => ({
          key: levelKeys.get(level.id)!,
          label: level.label,
          order: level.order,
        })),
        nodes: source.nodes.map((node) => ({
          key: nodeKeys.get(node.id)!,
          parentKey:
            node.parentId === null ? null : nodeKeys.get(node.parentId)!,
          kind: node.kind,
          name: node.name,
          description: node.description,
          order: node.order,
          weight: node.weight,
        })),
        coverages: source.levelCoverages.map((coverage) => ({
          leafKey: nodeKeys.get(coverage.leafNodeId)!,
          levelKey: levelKeys.get(coverage.levelId)!,
          targetItemCount: coverage.targetItemCount,
          enabled: coverage.enabled,
        })),
        assignments: source.elementAssignments.map((assignment) => ({
          elementId: assignment.elementId,
          leafKey: nodeKeys.get(assignment.leafNodeId)!,
          levelKey: levelKeys.get(assignment.levelId)!,
          enabled: assignment.enabled,
          discrimination: assignment.discrimination,
          enablePercentInput: assignment.enablePercentInput,
        })),
      },
    },
    ctx
  )
}

export async function linkCompetenceTreeToCourse(
  { treeId, courseId }: { treeId: string; courseId: string },
  ctx: ContextWithUser
): Promise<CompetenceTreeDetail> {
  await assertCourseAccess(courseId, DB.PermissionLevel.WRITE, ctx)

  await ctx.prisma.$transaction(async (tx) => {
    await lockOwnedCompetenceTree(tx, treeId, ctx.user.sub)
    await tx.competenceTreeCourse.upsert({
      where: { treeId_courseId: { treeId, courseId } },
      create: { treeId, courseId, linkedById: ctx.user.sub },
      update: {},
    })
  })

  return await getRequiredCompetenceTree(treeId, ctx)
}

export async function unlinkCompetenceTreeFromCourse(
  { treeId, courseId }: { treeId: string; courseId: string },
  ctx: ContextWithUser
): Promise<boolean> {
  await assertCourseAccess(courseId, DB.PermissionLevel.WRITE, ctx)

  return await ctx.prisma.$transaction(async (tx) => {
    await lockOwnedCompetenceTree(tx, treeId, ctx.user.sub)
    const adaptiveQuiz = await tx.practiceQuizAdaptiveConfig.findFirst({
      where: {
        competenceTreeId: treeId,
        practiceQuiz: { courseId, isDeleted: false },
      },
      select: { practiceQuizId: true },
    })
    if (adaptiveQuiz) {
      throw serviceError(
        'The competence tree link is used by an adaptive practice quiz and cannot be removed.',
        'COMPETENCE_TREE_LINK_IN_USE'
      )
    }

    const result = await tx.competenceTreeCourse.deleteMany({
      where: { treeId, courseId },
    })
    return result.count > 0
  })
}

export async function deleteCompetenceTree(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<boolean> {
  await ctx.prisma.$transaction(async (tx) => {
    await lockOwnedCompetenceTree(tx, id, ctx.user.sub)
    const tree = await tx.competenceTree.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            courseLinks: true,
            adaptivePracticeQuizConfigs: true,
          },
        },
      },
    })
    if (!tree) throw serviceError('Competence tree not found.', 'NOT_FOUND')

    if (
      tree._count.courseLinks === 0 &&
      tree._count.adaptivePracticeQuizConfigs === 0
    ) {
      await tx.competenceTree.delete({ where: { id } })
    } else {
      await tx.competenceTree.update({
        where: { id },
        data: { isDeleted: true },
      })
    }
  })

  return true
}

export async function archiveCompetenceTree(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<boolean> {
  await ctx.prisma.$transaction(async (tx) => {
    await lockOwnedCompetenceTreeAnyState(tx, id, ctx.user.sub)
    await tx.competenceTree.update({
      where: { id },
      data: { isArchived: true },
    })
  })
  return true
}

export async function restoreCompetenceTree(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<boolean> {
  await ctx.prisma.$transaction(async (tx) => {
    await lockOwnedCompetenceTreeAnyState(tx, id, ctx.user.sub)
    await tx.competenceTree.update({
      where: { id },
      data: { isArchived: false },
    })
  })
  return true
}

function readableTreeWhere(
  userId: string,
  includeArchived: boolean
): DB.Prisma.CompetenceTreeWhereInput {
  return {
    isDeleted: false,
    OR: [
      {
        ownerId: userId,
        isArchived: includeArchived ? undefined : false,
      },
      {
        isArchived: false,
        courseLinks: {
          some: {
            course: {
              OR: [{ ownerId: userId }, { permissions: { some: { userId } } }],
            },
          },
        },
      },
    ],
  }
}

async function getReadableCourseIds(
  ctx: ContextWithUser
): Promise<Set<string>> {
  const courses = await ctx.prisma.course.findMany({
    where: {
      OR: [
        { ownerId: ctx.user.sub },
        { permissions: { some: { userId: ctx.user.sub } } },
      ],
    },
    select: { id: true },
  })
  return new Set(courses.map(({ id }) => id))
}

async function assertTreeOwner(
  id: string,
  ctx: ContextWithUser
): Promise<void> {
  const tree = await ctx.prisma.competenceTree.findFirst({
    where: { id, ownerId: ctx.user.sub, isDeleted: false },
    select: { id: true },
  })
  if (!tree) throw serviceError('Competence tree not found.', 'NOT_FOUND')
}

async function lockOwnedCompetenceTree(
  tx: DB.Prisma.TransactionClient,
  id: string,
  ownerId: string
): Promise<void> {
  const rows = await tx.$queryRaw<
    Array<{ id: string; ownerId: string; isDeleted: boolean }>
  >`SELECT "id", "ownerId", "isDeleted"
    FROM "CompetenceTree"
    WHERE "id" = ${id}::uuid
    FOR UPDATE`
  const tree = rows[0]

  if (!tree || tree.ownerId !== ownerId || tree.isDeleted) {
    throw serviceError('Competence tree not found.', 'NOT_FOUND')
  }
}

async function lockOwnedCompetenceTreeAnyState(
  tx: DB.Prisma.TransactionClient,
  id: string,
  ownerId: string
): Promise<void> {
  const rows = await tx.$queryRaw<
    Array<{ id: string; ownerId: string; isDeleted: boolean }>
  >`
    SELECT "id", "ownerId", "isDeleted"
    FROM "CompetenceTree"
    WHERE "id" = ${id}::uuid
    FOR UPDATE
  `
  if (!rows[0] || rows[0].ownerId !== ownerId || rows[0].isDeleted) {
    throw serviceError('Competence tree not found.', 'NOT_FOUND')
  }
}

async function getAccessibleElement(
  elementId: number,
  userId: string,
  prisma: Pick<DB.Prisma.TransactionClient, 'element'>
) {
  const element = await prisma.element.findFirst({
    where: {
      id: elementId,
      isDeleted: false,
      OR: [{ ownerId: userId }, { permissions: { some: { userId } } }],
    },
    select: {
      id: true,
      type: true,
      name: true,
      version: true,
      options: true,
    },
  })
  if (!element) {
    throw serviceError(
      'The element does not exist or is not readable.',
      'FORBIDDEN'
    )
  }
  return element
}

async function assertCourseAccess(
  courseId: string,
  minimumPermission: DB.PermissionLevel,
  ctx: ContextWithUser
): Promise<void> {
  const acceptedLevels =
    minimumPermission === DB.PermissionLevel.READ
      ? Object.values(DB.PermissionLevel)
      : [
          DB.PermissionLevel.WRITE,
          DB.PermissionLevel.ADMIN,
          DB.PermissionLevel.OWNER,
        ]
  const course = await ctx.prisma.course.findFirst({
    where: {
      id: courseId,
      OR: [
        { ownerId: ctx.user.sub },
        {
          permissions: {
            some: {
              userId: ctx.user.sub,
              permissionLevel: { in: acceptedLevels },
            },
          },
        },
      ],
    },
    select: { id: true },
  })
  if (!course) throw serviceError('Course not found.', 'NOT_FOUND')
}

async function getRequiredCompetenceTree(
  id: string,
  ctx: ContextWithUser
): Promise<CompetenceTreeDetail> {
  const tree = await getCompetenceTree({ id }, ctx)
  if (!tree) throw serviceError('Competence tree not found.', 'NOT_FOUND')
  return tree
}

function toSummary(
  tree: SummaryRecord,
  userId: string,
  readableCourseIds: Set<string>
): CompetenceTreeSummary {
  const { _count, adaptivePracticeQuizConfigs, ...data } = tree
  const isOwner = tree.ownerId === userId
  const usage = getAdaptiveQuizUsage(adaptivePracticeQuizConfigs)
  return {
    ...data,
    courseLinks: isOwner
      ? tree.courseLinks
      : tree.courseLinks.filter(({ courseId }) =>
          readableCourseIds.has(courseId)
        ),
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
    const choiceCount = getChoiceCount(assignment.element.options)
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

  return {
    ...data,
    courseLinks: isOwner
      ? tree.courseLinks
      : tree.courseLinks.filter(({ courseId }) =>
          readableCourseIds.has(courseId)
        ),
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

function getAdaptiveQuizUsage(
  configs: Array<{
    practiceQuiz: Pick<DB.PracticeQuiz, 'status'>
  }>
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

function getChoiceCount(options: unknown): number | null {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return null
  }
  const choices = (options as Record<string, unknown>).choices
  return Array.isArray(choices) ? choices.length : null
}

function serviceError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } })
}

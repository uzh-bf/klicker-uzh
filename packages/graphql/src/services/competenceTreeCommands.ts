import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import { hasControlledAdaptiveAnswer } from './adaptiveElementValidation.js'
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
  type CompetenceTreeDetail,
  type CompetenceTreeElementAssignmentUpdateInput,
} from './competenceTreeManagementTypes.js'
import {
  competenceTreeDetailInclude,
  getCompetenceTree,
  getRequiredCompetenceTree,
} from './competenceTreeReadModels.js'
import {
  assertCompetenceTreeCourseAccess,
  assertCompetenceTreeOwner,
  competenceTreeServiceError,
  getAccessibleCompetenceTreeElement,
  lockOwnedCompetenceTree,
  lockOwnedCompetenceTreeAnyState,
} from './competenceTreeRepository.js'
import {
  validateCompetenceTreeShape,
  type CompetenceTreeValidationResult,
} from './competenceTrees.js'

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
  await assertCompetenceTreeOwner(id, ctx)
  const locked = await ctx.prisma.practiceQuizAdaptiveConfig.count({
    where: { competenceTreeId: id },
  })
  if (locked > 0) {
    throw competenceTreeServiceError(
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
      throw competenceTreeServiceError(
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
    await persistCompetenceTreeElementAssignment({
      treeId,
      elementId,
      assignment,
      ownerId: ctx.user.sub,
      tx,
    })
  })
  return await getRequiredCompetenceTree(treeId, ctx)
}

export async function persistCompetenceTreeElementAssignment({
  treeId,
  elementId,
  assignment,
  ownerId,
  tx,
}: {
  treeId: string
  elementId: number
  assignment?: CompetenceTreeElementAssignmentUpdateInput | null
  ownerId: string
  tx: DB.Prisma.TransactionClient
}): Promise<void> {
  await lockOwnedCompetenceTree(tx, treeId, ownerId)
  const locked = await tx.practiceQuizAdaptiveConfig.count({
    where: { competenceTreeId: treeId },
  })
  if (locked > 0) {
    throw competenceTreeServiceError(
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
      include: competenceTreeDetailInclude,
    }),
    getAccessibleCompetenceTreeElement(elementId, ownerId, tx),
  ])
  const coverage = tree.levelCoverages.find(
    (entry) =>
      entry.leafNodeId === assignment.leafNodeId &&
      entry.levelId === assignment.levelId &&
      entry.enabled
  )
  if (!coverage) {
    throw competenceTreeServiceError(
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
}

export async function duplicateCompetenceTree(
  { id, input }: { id: string; input?: DuplicateCompetenceTreeInput | null },
  ctx: ContextWithUser
): Promise<CompetenceTreeDetail> {
  const source = await getCompetenceTree({ id }, ctx)
  if (!source) {
    throw competenceTreeServiceError('Competence tree not found.', 'NOT_FOUND')
  }
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
  await assertCompetenceTreeCourseAccess(
    courseId,
    DB.PermissionLevel.WRITE,
    ctx
  )
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
  await assertCompetenceTreeCourseAccess(
    courseId,
    DB.PermissionLevel.WRITE,
    ctx
  )
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
      throw competenceTreeServiceError(
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
          select: { courseLinks: true, adaptivePracticeQuizConfigs: true },
        },
      },
    })
    if (!tree) {
      throw competenceTreeServiceError(
        'Competence tree not found.',
        'NOT_FOUND'
      )
    }
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
  await setCompetenceTreeArchiveState(id, true, ctx)
  return true
}

export async function restoreCompetenceTree(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<boolean> {
  await setCompetenceTreeArchiveState(id, false, ctx)
  return true
}

async function setCompetenceTreeArchiveState(
  id: string,
  isArchived: boolean,
  ctx: ContextWithUser
): Promise<void> {
  await ctx.prisma.$transaction(async (tx) => {
    await lockOwnedCompetenceTreeAnyState(tx, id, ctx.user.sub)
    await tx.competenceTree.update({ where: { id }, data: { isArchived } })
  })
}

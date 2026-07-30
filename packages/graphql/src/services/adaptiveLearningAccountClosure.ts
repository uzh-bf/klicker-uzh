import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'

type AdaptiveAccountClosurePrisma =
  | DB.PrismaClient
  | DB.Prisma.TransactionClient

export type AdaptiveLearningOwnedTree = {
  id: string
  name: string
  linkedCourseCount: number
  adaptiveConfigCount: number
  attemptCount: number
}

export type AdaptiveLearningAccountClosurePreflight = {
  userId: string
  ready: boolean
  blockingTreeCount: number
  linkedCourseCount: number
  adaptiveConfigCount: number
  attemptCount: number
  ownedTrees: AdaptiveLearningOwnedTree[]
}

export async function getAdaptiveLearningAccountClosurePreflight(
  userId: string,
  prisma: AdaptiveAccountClosurePrisma
): Promise<AdaptiveLearningAccountClosurePreflight> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!user) {
    throw new GraphQLError('The user account does not exist.', {
      extensions: { code: 'USER_NOT_FOUND' },
    })
  }

  const trees = await prisma.competenceTree.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          courseLinks: true,
          adaptivePracticeQuizConfigs: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  })
  const treeIds = trees.map(({ id }) => id)
  const attemptCounts =
    treeIds.length === 0
      ? []
      : await prisma.adaptivePracticeQuizAttempt.groupBy({
          by: ['competenceTreeId'],
          where: { competenceTreeId: { in: treeIds } },
          _count: { _all: true },
        })
  const attemptsByTree = new Map(
    attemptCounts.map(({ competenceTreeId, _count }) => [
      competenceTreeId,
      _count._all,
    ])
  )
  const ownedTrees = trees.map((tree) => ({
    id: tree.id,
    name: tree.name,
    linkedCourseCount: tree._count.courseLinks,
    adaptiveConfigCount: tree._count.adaptivePracticeQuizConfigs,
    attemptCount: attemptsByTree.get(tree.id) ?? 0,
  }))

  return {
    userId,
    ready: ownedTrees.length === 0,
    blockingTreeCount: ownedTrees.length,
    linkedCourseCount: ownedTrees.reduce(
      (total, tree) => total + tree.linkedCourseCount,
      0
    ),
    adaptiveConfigCount: ownedTrees.reduce(
      (total, tree) => total + tree.adaptiveConfigCount,
      0
    ),
    attemptCount: ownedTrees.reduce(
      (total, tree) => total + tree.attemptCount,
      0
    ),
    ownedTrees,
  }
}

export function assertAdaptiveLearningAccountClosureReady(
  preflight: AdaptiveLearningAccountClosurePreflight
): void {
  if (preflight.ready) {
    return
  }

  throw new GraphQLError(
    `Transfer ${preflight.blockingTreeCount} adaptive competence tree(s) before deleting this user account.`,
    {
      extensions: {
        code: 'ADAPTIVE_TREE_TRANSFER_REQUIRED',
        userId: preflight.userId,
        blockingTreeCount: preflight.blockingTreeCount,
      },
    }
  )
}

type LockedUser = { id: string }
type LockedCompetenceTree = { id: string; name: string }

export async function transferAdaptiveLearningCompetenceTrees(
  {
    sourceUserId,
    targetUserId,
    actorUserId,
  }: {
    sourceUserId: string
    targetUserId: string
    actorUserId: string
  },
  prisma: DB.Prisma.TransactionClient
): Promise<LockedCompetenceTree[]> {
  if (sourceUserId === targetUserId) {
    throw new GraphQLError(
      'The source and target users for an ownership transfer must differ.',
      { extensions: { code: 'ADAPTIVE_TREE_TRANSFER_INVALID' } }
    )
  }

  // Lock users in UUID order so concurrent reciprocal transfers cannot deadlock.
  const lockedUsers = await prisma.$queryRaw<LockedUser[]>`
    SELECT "id"
    FROM "User"
    WHERE "id" = ${sourceUserId}::uuid
      OR "id" = ${targetUserId}::uuid
    ORDER BY "id"
    FOR UPDATE
  `
  const lockedUserIds = new Set(lockedUsers.map(({ id }) => id))
  if (!lockedUserIds.has(sourceUserId)) {
    throw new GraphQLError('The source user account does not exist.', {
      extensions: { code: 'USER_NOT_FOUND' },
    })
  }
  if (!lockedUserIds.has(targetUserId)) {
    throw new GraphQLError('The target user account does not exist.', {
      extensions: { code: 'USER_NOT_FOUND' },
    })
  }

  const trees = await prisma.$queryRaw<LockedCompetenceTree[]>`
    SELECT "id", "name"
    FROM "CompetenceTree"
    WHERE "ownerId" = ${sourceUserId}::uuid
    ORDER BY "id"
    FOR UPDATE
  `
  if (trees.length === 0) {
    return []
  }

  const treeIds = trees.map(({ id }) => id)
  const transfer = await prisma.competenceTree.updateMany({
    where: {
      id: { in: treeIds },
      ownerId: sourceUserId,
    },
    data: { ownerId: targetUserId },
  })
  if (transfer.count !== trees.length) {
    throw new GraphQLError(
      'Adaptive competence-tree ownership changed during account closure.',
      { extensions: { code: 'ADAPTIVE_TREE_TRANSFER_CONFLICT' } }
    )
  }

  await prisma.auditLogEntry.createMany({
    data: trees.map(({ id }) => ({
      type: DB.AuditLogType.OWNER_TRANSFERRED,
      objectType: DB.ObjectType.COMPETENCE_TREE,
      objectId: id,
      sourceUserId: actorUserId,
      targetUserId,
      message: `Ownership of ${DB.ObjectType.COMPETENCE_TREE} (ID ${id}) transferred from user ${sourceUserId} to user ${targetUserId} during account closure.`,
    })),
  })

  return trees
}

import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'

export type AdaptiveSourceElementAvailability =
  | 'AVAILABLE'
  | 'DELETED'
  | 'OWNER_ACCESS_REVOKED'

export type AdaptivePublicationSourceAuthorization = {
  availability: ReadonlyMap<number, AdaptiveSourceElementAvailability>
}

export async function lockAdaptivePracticeQuizPublicationSources(
  practiceQuizId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<AdaptivePublicationSourceAuthorization> {
  const configIdentity = await prisma.practiceQuizAdaptiveConfig.findUnique({
    where: { practiceQuizId },
    select: {
      competenceTreeId: true,
      practiceQuiz: { select: { courseId: true } },
    },
  })
  if (!configIdentity) {
    throw publicationAuthorizationError(
      'Adaptive practice quiz configuration was not found.',
      'ADAPTIVE_CONFIG_MISSING'
    )
  }

  await lockAdaptiveCompetenceTreeForPublication(
    configIdentity.competenceTreeId,
    prisma
  )
  const config = await prisma.practiceQuizAdaptiveConfig.findUnique({
    where: { practiceQuizId },
    select: {
      competenceTree: {
        select: {
          ownerId: true,
          isDeleted: true,
          isArchived: true,
          courseLinks: { select: { courseId: true } },
          elementAssignments: {
            select: {
              elementId: true,
              element: { select: { isDeleted: true } },
            },
          },
        },
      },
    },
  })
  if (!config) {
    throw publicationAuthorizationError(
      'Adaptive practice quiz configuration was not found.',
      'ADAPTIVE_CONFIG_MISSING'
    )
  }

  const tree = config.competenceTree
  const treeAvailable =
    !tree.isDeleted &&
    !tree.isArchived &&
    tree.courseLinks.some(
      ({ courseId }) => courseId === configIdentity.practiceQuiz.courseId
    )
  if (!treeAvailable) {
    throw publicationAuthorizationError(
      'The competence tree is no longer available to this course.',
      'ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE'
    )
  }

  const elements = tree.elementAssignments.map((assignment) => ({
    id: assignment.elementId,
    isDeleted: assignment.element.isDeleted,
  }))
  const elementIds = uniqueSortedElementIds(elements.map(({ id }) => id))
  await lockAdaptiveSourceElementsForPublication(elementIds, prisma)
  await lockAdaptiveSourcePermissionsForPublication(
    tree.ownerId,
    elementIds,
    prisma
  )
  const availability = await resolveAdaptiveSourceElementAvailability({
    ownerId: tree.ownerId,
    elements,
    prisma,
  })
  return { availability }
}

async function lockAdaptiveCompetenceTreeForPublication(
  treeId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<void> {
  await prisma.$queryRaw`
    SELECT "id"
    FROM "CompetenceTree"
    WHERE "id" = ${treeId}::uuid
    FOR SHARE
  `
}

export function assertAdaptivePublicationSourceElementsAuthorized(
  elementIds: readonly number[],
  authorization: AdaptivePublicationSourceAuthorization
): void {
  if (
    elementIds.some(
      (elementId) => authorization.availability.get(elementId) !== 'AVAILABLE'
    )
  ) {
    throw publicationAuthorizationError(
      'One or more source elements are no longer available to the competence tree owner.',
      'ADAPTIVE_SOURCE_ELEMENT_UNAVAILABLE'
    )
  }
}

export async function resolveAdaptiveSourceElementAvailability({
  ownerId,
  elements,
  prisma,
}: {
  ownerId: string
  elements: readonly { id: number; isDeleted: boolean }[]
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
}): Promise<Map<number, AdaptiveSourceElementAvailability>> {
  const elementIds = uniqueSortedElementIds(elements.map(({ id }) => id))
  const readableIds =
    elementIds.length === 0
      ? []
      : await prisma.element.findMany({
          where: {
            id: { in: elementIds },
            isDeleted: false,
            OR: [{ ownerId }, { permissions: { some: { userId: ownerId } } }],
          },
          select: { id: true },
        })
  const readable = new Set(readableIds.map(({ id }) => id))
  const deleted = new Set(
    elements.filter(({ isDeleted }) => isDeleted).map(({ id }) => id)
  )

  return new Map(
    elementIds.map((elementId) => [
      elementId,
      deleted.has(elementId)
        ? 'DELETED'
        : readable.has(elementId)
          ? 'AVAILABLE'
          : 'OWNER_ACCESS_REVOKED',
    ])
  )
}

export async function lockAdaptiveElementPermissionRevocation(
  elementId: number,
  prisma: DB.Prisma.TransactionClient
): Promise<void> {
  await prisma.$queryRaw`
    SELECT "id"
    FROM "Element"
    WHERE "id" = ${elementId}
    FOR UPDATE
  `
}

async function lockAdaptiveSourceElementsForPublication(
  elementIds: number[],
  prisma: DB.Prisma.TransactionClient
): Promise<void> {
  if (elementIds.length === 0) return
  await prisma.$queryRaw`
    SELECT "id"
    FROM "Element"
    WHERE "id" IN (${DB.Prisma.join(elementIds)})
    ORDER BY "id"
    FOR SHARE
  `
}

async function lockAdaptiveSourcePermissionsForPublication(
  ownerId: string,
  elementIds: number[],
  prisma: DB.Prisma.TransactionClient
): Promise<void> {
  if (elementIds.length === 0) return
  await prisma.$queryRaw`
    SELECT "id"
    FROM "DerivedPermission"
    WHERE "userId" = ${ownerId}::uuid
      AND "elementId" IN (${DB.Prisma.join(elementIds)})
    ORDER BY "elementId"
    FOR SHARE
  `
}

function uniqueSortedElementIds(elementIds: readonly number[]) {
  return Array.from(new Set(elementIds)).sort((left, right) => left - right)
}

function publicationAuthorizationError(message: string, code: string) {
  return new GraphQLError(message, { extensions: { code } })
}

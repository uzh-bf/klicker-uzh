import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'

export function competenceTreeServiceError(
  message: string,
  code: string
): GraphQLError {
  return new GraphQLError(message, { extensions: { code } })
}

export function readableCompetenceTreeWhere(
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

export async function getReadableCompetenceTreeCourseIds(
  ctx: ContextWithUser,
  courseIds?: string[]
): Promise<Set<string>> {
  if (courseIds?.length === 0) return new Set()
  const courses = await ctx.prisma.course.findMany({
    where: {
      AND: [
        ...(courseIds ? [{ id: { in: courseIds } }] : []),
        {
          OR: [
            { ownerId: ctx.user.sub },
            { permissions: { some: { userId: ctx.user.sub } } },
          ],
        },
      ],
    },
    select: { id: true },
  })
  return new Set(courses.map(({ id }) => id))
}

export async function assertCompetenceTreeOwner(
  id: string,
  ctx: ContextWithUser
): Promise<void> {
  const tree = await ctx.prisma.competenceTree.findFirst({
    where: { id, ownerId: ctx.user.sub, isDeleted: false },
    select: { id: true },
  })
  if (!tree) {
    throw competenceTreeServiceError('Competence tree not found.', 'NOT_FOUND')
  }
}

export async function lockOwnedCompetenceTree(
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
    throw competenceTreeServiceError('Competence tree not found.', 'NOT_FOUND')
  }
}

export async function lockOwnedCompetenceTreeAnyState(
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
    throw competenceTreeServiceError('Competence tree not found.', 'NOT_FOUND')
  }
}

export async function getAccessibleCompetenceTreeElement(
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
    throw competenceTreeServiceError(
      'The element does not exist or is not readable.',
      'FORBIDDEN'
    )
  }
  return element
}

export async function assertCompetenceTreeCourseAccess(
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
  if (!course) {
    throw competenceTreeServiceError('Course not found.', 'NOT_FOUND')
  }
}

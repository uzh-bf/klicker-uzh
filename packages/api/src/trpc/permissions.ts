import { PermissionLevel, type Prisma } from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { getPrisma, type TRPCContext } from './context.js'
import { throwForbidden } from './errors.js'

type TRPCContextWithUserId = TRPCContext & {
  user: {
    sub: string
  }
}

const acceptedPermissionLevels: Record<PermissionLevel, PermissionLevel[]> = {
  [PermissionLevel.OWNER]: [PermissionLevel.OWNER],
  [PermissionLevel.ADMIN]: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
  [PermissionLevel.WRITE]: [
    PermissionLevel.WRITE,
    PermissionLevel.ADMIN,
    PermissionLevel.OWNER,
  ],
  [PermissionLevel.EXECUTE]: [
    PermissionLevel.EXECUTE,
    PermissionLevel.WRITE,
    PermissionLevel.ADMIN,
    PermissionLevel.OWNER,
  ],
  [PermissionLevel.READ]: [
    PermissionLevel.READ,
    PermissionLevel.EXECUTE,
    PermissionLevel.WRITE,
    PermissionLevel.ADMIN,
    PermissionLevel.OWNER,
  ],
}

export async function hasLiveQuizPermission(
  ctx: TRPCContextWithUserId,
  liveQuizId: string,
  requiredPermissionLevel: PermissionLevel
) {
  const prisma = getPrisma(ctx)
  const permission = await prisma.derivedPermission.findFirst({
    where: {
      liveQuizId,
      userId: ctx.user.sub,
      permissionLevel: {
        in: acceptedPermissionLevels[requiredPermissionLevel],
      },
    },
  })

  return Boolean(permission)
}

export async function hasCoursePermission(
  ctx: TRPCContextWithUserId,
  courseId: string,
  requiredPermissionLevel: PermissionLevel
) {
  const prisma = getPrisma(ctx)
  const permission = await prisma.derivedPermission.findFirst({
    where: {
      courseId,
      userId: ctx.user.sub,
      permissionLevel: {
        in: acceptedPermissionLevels[requiredPermissionLevel],
      },
    },
  })

  return Boolean(permission)
}

function getActivityPermissionWhere({
  activityId,
  activityType,
}: {
  activityId: string
  activityType: ActivityType
}): Pick<
  Prisma.DerivedPermissionWhereInput,
  'liveQuizId' | 'practiceQuizId' | 'microLearningId' | 'groupActivityId'
> {
  switch (activityType) {
    case ActivityType.LIVE_QUIZ:
      return { liveQuizId: activityId }
    case ActivityType.PRACTICE_QUIZ:
      return { practiceQuizId: activityId }
    case ActivityType.MICRO_LEARNING:
      return { microLearningId: activityId }
    case ActivityType.GROUP_ACTIVITY:
      return { groupActivityId: activityId }
  }
}

export async function hasActivityPermission(
  ctx: TRPCContextWithUserId,
  {
    activityId,
    activityType,
  }: {
    activityId: string
    activityType: ActivityType
  },
  requiredPermissionLevel: PermissionLevel
) {
  const prisma = getPrisma(ctx)
  const permission = await prisma.derivedPermission.findFirst({
    where: {
      ...getActivityPermissionWhere({ activityId, activityType }),
      userId: ctx.user.sub,
      permissionLevel: {
        in: acceptedPermissionLevels[requiredPermissionLevel],
      },
    },
  })

  return Boolean(permission)
}

export async function requireLiveQuizPermission(
  ctx: TRPCContextWithUserId,
  liveQuizId: string,
  requiredPermissionLevel: PermissionLevel
) {
  if (
    !(await hasLiveQuizPermission(ctx, liveQuizId, requiredPermissionLevel))
  ) {
    throwForbidden()
  }
}

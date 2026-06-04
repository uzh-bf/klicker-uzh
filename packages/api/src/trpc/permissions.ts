import { PermissionLevel } from '@klicker-uzh/prisma/client'
import { getPrisma, type TRPCContextWithUser } from './context.js'
import { throwForbidden } from './errors.js'

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
  ctx: TRPCContextWithUser,
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
  ctx: TRPCContextWithUser,
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

export async function requireLiveQuizPermission(
  ctx: TRPCContextWithUser,
  liveQuizId: string,
  requiredPermissionLevel: PermissionLevel
) {
  if (
    !(await hasLiveQuizPermission(ctx, liveQuizId, requiredPermissionLevel))
  ) {
    throwForbidden()
  }
}

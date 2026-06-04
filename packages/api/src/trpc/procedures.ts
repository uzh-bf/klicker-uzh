import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import type { TRPCContext, TRPCContextWithUser, TRPCUser } from './context.js'
import { throwForbidden, throwUnauthorized } from './errors.js'
import { middleware, publicProcedure } from './init.js'

function isAuthenticatedUser(
  user: TRPCContext['user']
): user is TRPCContextWithUser['user'] {
  return !!user?.sub && user.scope !== UserLoginScope.OTP
}

export function hasUserRole(
  userRole: TRPCUser['role'],
  requiredRole: UserRole
) {
  if (requiredRole === UserRole.PARTICIPANT) {
    return userRole === UserRole.PARTICIPANT
  }

  if (requiredRole === UserRole.USER) {
    return userRole === UserRole.USER || userRole === UserRole.ADMIN
  }

  if (requiredRole === UserRole.ADMIN) {
    return userRole === UserRole.ADMIN
  }

  return userRole === requiredRole
}

export function hasUserScope(
  userScope: TRPCUser['scope'],
  requiredScope: UserLoginScope
) {
  switch (requiredScope) {
    case UserLoginScope.ACCOUNT_OWNER:
      return userScope === UserLoginScope.ACCOUNT_OWNER
    case UserLoginScope.FULL_ACCESS:
      return (
        userScope === UserLoginScope.ACCOUNT_OWNER ||
        userScope === UserLoginScope.FULL_ACCESS
      )
    case UserLoginScope.SESSION_EXEC:
      return (
        userScope === UserLoginScope.ACCOUNT_OWNER ||
        userScope === UserLoginScope.FULL_ACCESS ||
        userScope === UserLoginScope.SESSION_EXEC
      )
    case UserLoginScope.READ_ONLY:
      return (
        userScope === UserLoginScope.ACCOUNT_OWNER ||
        userScope === UserLoginScope.FULL_ACCESS ||
        userScope === UserLoginScope.SESSION_EXEC ||
        userScope === UserLoginScope.READ_ONLY
      )
    default:
      return false
  }
}

const requireAuthenticated = middleware(({ ctx, next }) => {
  if (!isAuthenticatedUser(ctx.user)) {
    throwUnauthorized()
  }

  return next({
    ctx: {
      user: ctx.user,
    },
  })
})

function requireRole(requiredRole: UserRole) {
  return middleware(({ ctx, next }) => {
    if (!ctx.user || !hasUserRole(ctx.user.role, requiredRole)) {
      throwForbidden()
    }

    return next()
  })
}

function requireScope(requiredScope: UserLoginScope) {
  return middleware(({ ctx, next }) => {
    if (!ctx.user?.scope || !hasUserScope(ctx.user.scope, requiredScope)) {
      throwForbidden()
    }

    return next()
  })
}

export const authenticatedProcedure = publicProcedure.use(requireAuthenticated)
export const participantProcedure = authenticatedProcedure.use(
  requireRole(UserRole.PARTICIPANT)
)
export const temporaryParticipantProcedure = authenticatedProcedure.use(
  requireRole(UserRole.TEMPORARY_PARTICIPANT)
)
export const userProcedure = authenticatedProcedure.use(
  requireRole(UserRole.USER)
)
export const userFullAccessProcedure = userProcedure.use(
  requireScope(UserLoginScope.FULL_ACCESS)
)
export const userSessionExecProcedure = userProcedure.use(
  requireScope(UserLoginScope.SESSION_EXEC)
)

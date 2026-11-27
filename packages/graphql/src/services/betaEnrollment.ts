import { UserLoginScope } from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import { getBetaPreference } from '../lib/featureFlags.js'

export interface BetaEnrollmentCapability {
  mayChange: boolean
  membership: boolean | null
  signupAvailable: boolean
}

function errorDiagnostics(error: unknown) {
  const name = error instanceof Error ? error.name : undefined
  const code =
    error instanceof Error && 'code' in error ? error.code : undefined
  return {
    errorType:
      name &&
      [
        'Error',
        'TypeError',
        'PrismaClientKnownRequestError',
        'PrismaClientUnknownRequestError',
        'PrismaClientInitializationError',
        'PrismaClientValidationError',
      ].includes(name)
        ? name
        : 'UnknownError',
    prismaCode:
      typeof code === 'string' &&
      [
        'P1000',
        'P1001',
        'P1002',
        'P1010',
        'P1017',
        'P2021',
        'P2022',
        'P2024',
        'P2025',
      ].includes(code)
        ? code
        : undefined,
  }
}

function hasFullAccess(ctx: ContextWithUser): boolean {
  return (
    ctx.user.scope === UserLoginScope.ACCOUNT_OWNER ||
    ctx.user.scope === UserLoginScope.FULL_ACCESS
  )
}

function capability(
  ctx: ContextWithUser,
  membership: boolean | null
): BetaEnrollmentCapability {
  const signupAvailable =
    ctx.user.catalystInstitutional || ctx.user.catalystIndividual
  return {
    membership,
    signupAvailable,
    mayChange:
      hasFullAccess(ctx) &&
      membership !== null &&
      (membership || signupAvailable),
  }
}

export async function getBetaEnrollment(
  _args: Record<string, never>,
  ctx: ContextWithUser
): Promise<BetaEnrollmentCapability> {
  if (!hasFullAccess(ctx)) return capability(ctx, null)
  try {
    return capability(ctx, await getBetaPreference(ctx))
  } catch (error) {
    ctx.log.error(
      { event: 'beta_enrollment.read.failed', ...errorDiagnostics(error) },
      'Failed to read beta preference'
    )
    return capability(ctx, null)
  }
}

export async function setBetaEnrollment(
  { enabled }: { enabled: boolean },
  ctx: ContextWithUser
): Promise<BetaEnrollmentCapability> {
  if (!hasFullAccess(ctx)) {
    throw new GraphQLError('Beta enrollment requires full account access', {
      extensions: { code: 'FORBIDDEN' },
    })
  }
  if (
    enabled &&
    !ctx.user.catalystInstitutional &&
    !ctx.user.catalystIndividual
  ) {
    throw new GraphQLError('Beta enrollment is not available', {
      extensions: { code: 'FORBIDDEN' },
    })
  }
  try {
    const user = await ctx.prisma.user.update({
      where: { id: ctx.user.sub },
      data: { betaEnabled: enabled },
      select: { betaEnabled: true },
    })
    ctx.betaPreference = {
      userId: ctx.user.sub,
      value: Promise.resolve(user.betaEnabled),
    }
    return capability(ctx, user.betaEnabled)
  } catch (error) {
    ctx.log.error(
      { event: 'beta_enrollment.update.failed', ...errorDiagnostics(error) },
      'Failed to update beta preference'
    )
    throw new GraphQLError('Failed to update beta enrollment', {
      extensions: { code: 'BETA_ENROLLMENT_UPDATE_FAILED' },
    })
  }
}

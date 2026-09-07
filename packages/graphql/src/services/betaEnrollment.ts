import { UserLoginScope } from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import { getBetaPreference } from '../lib/featureFlags.js'

export interface BetaEnrollmentCapability {
  mayChange: boolean
  membership: boolean | null
  signupAvailable: boolean
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
  } catch {
    console.error('Failed to read beta preference')
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
  } catch {
    console.error('Failed to update beta preference')
    throw new GraphQLError('Failed to update beta enrollment', {
      extensions: { code: 'BETA_ENROLLMENT_UPDATE_FAILED' },
    })
  }
}

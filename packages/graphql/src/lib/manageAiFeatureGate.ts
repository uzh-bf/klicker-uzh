import type { FeatureFlagAttributes } from '@klicker-uzh/feature-flags'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from './context.js'

export type ManageAiCapabilityState =
  | 'enabled'
  | 'disabled'
  | 'temporarilyUnavailable'

export function manageAiFeatureFlagAttributes(
  user: ContextWithUser['user']
): FeatureFlagAttributes {
  return {
    actorType: 'user',
    catalyst: user.catalystInstitutional || user.catalystIndividual,
    id: user.sub,
    role: user.role,
  }
}

export async function isManageAiEnabled(
  ctx: ContextWithUser
): Promise<boolean> {
  return (await getManageAiCapability(ctx)) === 'enabled'
}

export async function getManageAiCapability(
  ctx: ContextWithUser
): Promise<ManageAiCapabilityState> {
  const account = await ctx.prisma.user.findUnique({
    select: { aiFeaturesEnabled: true, betaEnabled: true },
    where: { id: ctx.user.sub },
  })

  // The database entitlement is the immediate per-account stop. Do not ask
  // GrowthBook for an answer when the account is not entitled, so an outage
  // cannot make a denied account appear temporarily unavailable.
  if (account?.aiFeaturesEnabled !== true || account.betaEnabled !== true) {
    return 'disabled'
  }

  try {
    return (
      ctx.featureFlags?.getAiBetaDecision({
        ...manageAiFeatureFlagAttributes(ctx.user),
        betaEnabled: account.betaEnabled,
      }) ?? 'temporarilyUnavailable'
    )
  } catch {
    console.warn(
      '[feature-flags] AI beta evaluation failed; temporarily unavailable'
    )
    return 'temporarilyUnavailable'
  }
}

export async function assertManageAiEnabled(
  ctx: ContextWithUser
): Promise<void> {
  const capability = await getManageAiCapability(ctx)
  if (capability === 'enabled') return

  if (capability === 'temporarilyUnavailable') {
    throw new GraphQLError('AI features are temporarily unavailable', {
      extensions: { code: 'AI_FEATURE_TEMPORARILY_UNAVAILABLE' },
    })
  }

  throw new GraphQLError('AI beta access is required', {
    extensions: { code: 'AI_BETA_ACCESS_REQUIRED' },
  })
}

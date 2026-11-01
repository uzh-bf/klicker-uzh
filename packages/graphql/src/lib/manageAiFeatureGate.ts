import type { FeatureFlagAttributes } from '@klicker-uzh/feature-flags'
import { GraphQLError } from 'graphql'
import type { ContextWithUser, FeatureFlagEvaluator } from './context.js'
import type { FeatureFlagAccount } from './featureFlags.js'

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

function decideManageAiCapability(
  featureFlags: FeatureFlagEvaluator | undefined,
  account: { aiFeaturesEnabled: boolean; betaEnabled: boolean } | null,
  attributes: FeatureFlagAttributes
): ManageAiCapabilityState {
  // The database entitlement is the immediate per-account stop. Do not ask
  // GrowthBook for an answer when the account is not entitled, so an outage
  // cannot make a denied account appear temporarily unavailable.
  if (account?.aiFeaturesEnabled !== true || account.betaEnabled !== true) {
    return 'disabled'
  }

  try {
    return (
      featureFlags?.getAiBetaDecision({
        ...attributes,
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

export async function getManageAiCapability(
  ctx: ContextWithUser
): Promise<ManageAiCapabilityState> {
  const account = await ctx.prisma.user.findUnique({
    select: { aiFeaturesEnabled: true, betaEnabled: true },
    where: { id: ctx.user.sub },
  })

  return decideManageAiCapability(
    ctx.featureFlags,
    account,
    manageAiFeatureFlagAttributes(ctx.user)
  )
}

/**
 * The same AI entitlement for a stored account that no request session
 * represents, such as the owner a trusted worker prepares work for. Rollout
 * attributes come from the account row instead of session claims.
 */
export function getAccountManageAiCapability(
  featureFlags: FeatureFlagEvaluator | undefined,
  account: (FeatureFlagAccount & { aiFeaturesEnabled: boolean }) | null
): ManageAiCapabilityState {
  return decideManageAiCapability(
    featureFlags,
    account,
    account
      ? {
          actorType: 'user',
          catalyst: account.catalystInstitutional || account.catalystIndividual,
          id: account.id,
          role: account.role,
        }
      : { actorType: 'user' }
  )
}

export function assertManageAiCapability(
  capability: ManageAiCapabilityState
): void {
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

export async function assertManageAiEnabled(
  ctx: ContextWithUser
): Promise<void> {
  assertManageAiCapability(await getManageAiCapability(ctx))
}

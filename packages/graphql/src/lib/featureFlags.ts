import type { FeatureFlagKey } from '@klicker-uzh/feature-flags'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from './context.js'

type FeatureFlagAccessContext = Pick<
  ContextWithUser,
  'featureFlags' | 'user' | 'prisma' | 'betaPreference'
>

export function getBetaPreference(
  ctx: FeatureFlagAccessContext
): Promise<boolean | null> {
  if (ctx.betaPreference?.userId !== ctx.user.sub) {
    ctx.betaPreference = {
      userId: ctx.user.sub,
      value: ctx.prisma.user
        .findUnique({
          where: { id: ctx.user.sub },
          select: { betaEnabled: true },
        })
        .then((user) => user?.betaEnabled ?? null),
    }
  }
  return ctx.betaPreference.value
}

// Fail closed: an absent, uninitialized, stale, or erroring evaluator denies
// the capability. Callers decide whether denial is an error or a hidden result.
export async function isFeatureFlagEnabled(
  ctx: FeatureFlagAccessContext,
  key: FeatureFlagKey
): Promise<boolean> {
  try {
    if (!ctx.featureFlags) return false
    const betaEnabled = await getBetaPreference(ctx)
    if (key === 'ai-beta' && betaEnabled !== true) return false
    return (
      ctx.featureFlags?.isEnabled(key, {
        id: ctx.user.sub,
        actorType: 'user',
        catalyst: ctx.user.catalystInstitutional || ctx.user.catalystIndividual,
        role: ctx.user.role,
        betaEnabled: betaEnabled === true,
      }) ?? false
    )
  } catch {
    console.warn(
      `[feature-flags] Evaluation failed for "${key}"; denying access`
    )
    return false
  }
}

export async function requireFeatureFlagAccess(
  ctx: FeatureFlagAccessContext,
  key: FeatureFlagKey
): Promise<void> {
  if (!(await isFeatureFlagEnabled(ctx, key))) {
    throw new GraphQLError('Forbidden', {
      extensions: { code: 'FORBIDDEN' },
    })
  }
}

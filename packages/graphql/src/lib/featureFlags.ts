import type { FeatureFlagKey } from '@klicker-uzh/feature-flags'
import type { UserRole } from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser, FeatureFlagEvaluator } from './context.js'

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

export interface FeatureFlagAccount {
  id: string
  role: UserRole
  catalystInstitutional: boolean
  catalystIndividual: boolean
  betaEnabled: boolean
}

// Evaluates a flag for a stored account that no request session represents,
// such as the knowledge-base owner a trusted worker prepares work for. The
// attributes come from the account row, and evaluation fails closed exactly
// like the session path.
export function isFeatureFlagEnabledForAccount(
  featureFlags: FeatureFlagEvaluator | undefined,
  account: FeatureFlagAccount,
  key: FeatureFlagKey
): boolean {
  try {
    if (!featureFlags) return false
    if (key === 'ai-beta' && account.betaEnabled !== true) return false
    return featureFlags.isEnabled(key, {
      id: account.id,
      actorType: 'user',
      catalyst: account.catalystInstitutional || account.catalystIndividual,
      role: account.role,
      betaEnabled: account.betaEnabled === true,
    })
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

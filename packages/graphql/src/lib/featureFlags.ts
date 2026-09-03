import type { FeatureFlagKey } from '@klicker-uzh/feature-flags'
import type { ContextWithUser } from './context.js'

type FeatureFlagAccessContext = Pick<ContextWithUser, 'featureFlags' | 'user'>

// Fail closed: an absent, uninitialized, stale, or erroring evaluator denies
// the capability. Callers decide whether denial is an error or a hidden result.
export function isFeatureFlagEnabled(
  ctx: FeatureFlagAccessContext,
  key: FeatureFlagKey
): boolean {
  try {
    return (
      ctx.featureFlags?.isEnabled(key, {
        id: ctx.user.sub,
        actorType: 'user',
        role: ctx.user.role,
      }) ?? false
    )
  } catch {
    console.warn(
      `[feature-flags] Evaluation failed for "${key}"; denying access`
    )
    return false
  }
}

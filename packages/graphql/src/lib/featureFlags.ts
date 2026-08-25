import type { FeatureFlagKey } from '@klicker-uzh/feature-flags'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from './context.js'

type FeatureFlagAccessContext = Pick<ContextWithUser, 'featureFlags' | 'user'>

export function requireFeatureFlagAccess(
  ctx: FeatureFlagAccessContext,
  key: FeatureFlagKey
): void {
  let enabled = false

  try {
    enabled =
      ctx.featureFlags?.isEnabled(key, {
        id: ctx.user.sub,
        actorType: 'user',
        role: ctx.user.role,
      }) ?? false
  } catch {
    console.warn(
      `[feature-flags] Evaluation failed for "${key}"; denying access`
    )
  }

  if (!enabled) {
    throw new GraphQLError('Forbidden', {
      extensions: { code: 'FORBIDDEN' },
    })
  }
}

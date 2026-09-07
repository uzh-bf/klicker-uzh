import type { FeatureFlagAttributes } from '@klicker-uzh/feature-flags'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from './context.js'
import { isFeatureFlagEnabled } from './featureFlags.js'

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
  if (!(await isFeatureFlagEnabled(ctx, 'ai-beta'))) {
    return false
  }

  const account = await ctx.prisma.user.findUnique({
    select: { aiFeaturesEnabled: true },
    where: { id: ctx.user.sub },
  })

  return account?.aiFeaturesEnabled === true
}

export async function assertManageAiEnabled(
  ctx: ContextWithUser
): Promise<void> {
  if (!(await isManageAiEnabled(ctx))) {
    throw new GraphQLError('AI beta access is required', {
      extensions: { code: 'AI_BETA_ACCESS_REQUIRED' },
    })
  }
}

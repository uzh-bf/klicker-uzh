import type { FeatureFlagAttributes } from '@klicker-uzh/feature-flags'
import { NodeFeatureFlagClient } from '@klicker-uzh/feature-flags/node'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from './context.js'

const featureFlagClient = new NodeFeatureFlagClient({
  apiHost: process.env.GROWTHBOOK_API_HOST,
  clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
  environment: process.env.GROWTHBOOK_ENV,
  forcedOn: process.env.FEATURE_FLAGS_FORCED_ON,
})

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
  await featureFlagClient.initialize()
  if (
    !featureFlagClient.isEnabled(
      'ai-beta',
      manageAiFeatureFlagAttributes(ctx.user)
    )
  ) {
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

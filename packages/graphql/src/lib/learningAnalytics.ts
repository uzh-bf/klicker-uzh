import { GraphQLError } from 'graphql'

export function isLearningAnalyticsRolloutEnabled() {
  return process.env.NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED === 'true'
}

export function assertLearningAnalyticsRolloutEnabled() {
  if (!isLearningAnalyticsRolloutEnabled()) {
    throw new GraphQLError('LEARNING_ANALYTICS_NOT_AVAILABLE', {
      extensions: { code: 'LEARNING_ANALYTICS_NOT_AVAILABLE' },
    })
  }
}

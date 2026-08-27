import { GraphQLError } from 'graphql'

export const CATALYST_LEARNING_ANALYTICS_UNAVAILABLE =
  'CATALYST_LEARNING_ANALYTICS_UNAVAILABLE'

export function isCatalystLearningAnalyticsAvailable(): boolean {
  return process.env.CATALYST_LEARNING_ANALYTICS_AVAILABLE === 'true'
}

export function requireCatalystLearningAnalyticsAvailable(): void {
  if (isCatalystLearningAnalyticsAvailable()) return

  throw new GraphQLError(CATALYST_LEARNING_ANALYTICS_UNAVAILABLE, {
    extensions: { code: CATALYST_LEARNING_ANALYTICS_UNAVAILABLE },
  })
}

import { NodeFeatureFlagClient } from '@klicker-uzh/feature-flags/node'

export type PersonalCardGenerationTarget = {
  participantId: string
  chatbotId: string
}

export type PersonalCardGenerationEvaluator = (
  target: PersonalCardGenerationTarget
) => boolean | Promise<boolean>

type FeatureFlagClient = Pick<
  NodeFeatureFlagClient,
  'initialize' | 'isEnabled' | 'getStatus'
>

type EvaluatorOptions = {
  client?: FeatureFlagClient
  nodeEnvironment?: string
  developmentOverride?: string | undefined
}

function createDefaultClient() {
  return new NodeFeatureFlagClient({
    apiHost: process.env.GROWTHBOOK_API_HOST,
    clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
    environment: process.env.GROWTHBOOK_ENV ?? process.env.NODE_ENV,
  })
}

/**
 * Evaluates the Chat-only creation capability. The SDK is process-scoped, but
 * attributes stay request-scoped so a participant cannot inherit another
 * participant's targeting decision.
 */
export function createPersonalCardGenerationEvaluator(
  options: EvaluatorOptions = {}
): PersonalCardGenerationEvaluator {
  const client = options.client ?? createDefaultClient()
  const nodeEnvironment = options.nodeEnvironment ?? process.env.NODE_ENV
  const developmentOverride =
    options.developmentOverride ?? process.env.PERSONAL_CARD_GENERATION_ENABLED
  let initialization: Promise<boolean> | undefined

  return async ({ participantId, chatbotId }) => {
    if (
      nodeEnvironment === 'development' &&
      developmentOverride?.toLowerCase() === 'true'
    ) {
      return true
    }

    try {
      initialization ??= client.initialize()
      if (!(await initialization) || !client.getStatus().healthy) return false

      return client.isEnabled('personal-card-generation', {
        id: participantId,
        actorType: 'participant',
        role: 'PARTICIPANT',
        chatbotId,
      })
    } catch {
      return false
    }
  }
}

let defaultEvaluator: PersonalCardGenerationEvaluator | undefined

export function isPersonalCardGenerationEnabled(
  target: PersonalCardGenerationTarget
) {
  defaultEvaluator ??= createPersonalCardGenerationEvaluator()
  return defaultEvaluator(target)
}

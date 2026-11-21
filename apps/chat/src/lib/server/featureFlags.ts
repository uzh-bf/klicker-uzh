import type {
  AiBetaDecision,
  FeatureFlagAttributes,
} from '@klicker-uzh/feature-flags'
import { NodeFeatureFlagClient } from '@klicker-uzh/feature-flags/node'
import { prisma } from '@klicker-uzh/prisma'
import type { AuthenticatedManageUser } from './manageAuth'

// One client per process, not per request: it holds the fetched payload and a
// single in-flight initialization, so building a fresh one per request would
// re-fetch on every call and turn an unreachable GrowthBook into a per-request
// timeout. Evaluation itself is stateless — attributes are passed in.
let client: NodeFeatureFlagClient | undefined

function getFeatureFlagClient(): NodeFeatureFlagClient {
  if (!client) {
    client = new NodeFeatureFlagClient({
      apiHost: process.env.GROWTHBOOK_API_HOST,
      clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
      environment: process.env.GROWTHBOOK_ENV,
      forcedOn: process.env.FEATURE_FLAGS_FORCED_ON,
    })
  }

  return client
}

export function manageFeatureFlagAttributes(
  user: AuthenticatedManageUser
): FeatureFlagAttributes {
  return {
    actorType: 'user',
    catalyst: user.catalyst,
    id: user.sub,
    role: user.role,
  }
}

/**
 * The gate over the Manage assistant: the assistant page, its API routes, the
 * lecturer MCP tools it is given and the proposal confirmation route. It opens
 * to every Catalyst lecturer who keeps the beta preference and is in the
 * `ai-beta` rollout. Unlike knowledge bases, chatbots and question generation,
 * it does not require the account's `aiFeaturesEnabled` approval; the
 * assistant's own per-user rate limits bound its use.
 *
 * A non-Catalyst session or a withdrawn beta preference returns `disabled`
 * before GrowthBook is evaluated, so an outage cannot make a denied account
 * appear temporarily unavailable.
 */
export async function getManageAssistantCapability(
  user: AuthenticatedManageUser
): Promise<AiBetaDecision> {
  if (!user.catalyst) return 'disabled'

  const account = await prisma.user.findUnique({
    select: { betaEnabled: true },
    where: { id: user.sub },
  })

  if (account?.betaEnabled !== true) return 'disabled'

  const featureFlags = getFeatureFlagClient()
  try {
    await featureFlags.initialize()
    return featureFlags.getAiBetaDecision({
      ...manageFeatureFlagAttributes(user),
      betaEnabled: account.betaEnabled,
    })
  } catch {
    console.warn(
      '[feature-flags] AI beta evaluation failed; temporarily unavailable'
    )
    return 'temporarilyUnavailable'
  }
}

/** Graph retrieval targets the owning lecturer, independently of map visibility. */
export async function isChatbotGraphRetrievalEnabled(
  ownerId: string
): Promise<boolean> {
  try {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        role: true,
        catalystInstitutional: true,
        catalystIndividual: true,
        betaEnabled: true,
      },
    })
    if (!owner || owner.betaEnabled !== true) return false
    const flags = getFeatureFlagClient()
    await flags.initialize()
    return flags.isEnabled('ai-beta', {
      id: ownerId,
      actorType: 'user',
      role: owner.role,
      catalyst: owner.catalystInstitutional || owner.catalystIndividual,
      betaEnabled: owner.betaEnabled,
    })
  } catch {
    return false
  }
}

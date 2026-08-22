import type {
  BooleanFeatureFlagKey,
  FeatureFlagAttributes,
  KlickerFeatureFlags,
} from '@klicker-uzh/feature-flags'
import { NodeFeatureFlagClient } from '@klicker-uzh/feature-flags/node'
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
 * Evaluates one flag for a signed-in lecturer. Unconfigured or unreachable
 * GrowthBook yields `false`, so a gate written with this refuses rather than
 * opens when the service is missing.
 */
export async function isManageFeatureEnabled(
  key: BooleanFeatureFlagKey<KlickerFeatureFlags>,
  user: AuthenticatedManageUser
): Promise<boolean> {
  const featureFlags = getFeatureFlagClient()
  await featureFlags.initialize()
  return featureFlags.isEnabled(key, manageFeatureFlagAttributes(user))
}

import type { FeatureFlagAttributes } from '@klicker-uzh/feature-flags'
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
 * The complete gate over every lecturer-facing AI surface: the `ai-beta` flag,
 * which decides whether the beta is open to this lecturer at all, and the
 * account's `aiFeaturesEnabled` setting, which records that an administrator
 * has a cost center to bill the resulting model usage to. Both must hold.
 *
 * The account setting is read live rather than from the session token, so
 * withdrawing it takes effect on the next request instead of at the lecturer's
 * next sign-in — it is the switch that stops spending, and a stale snapshot
 * would keep spending against a revoked cost center.
 *
 * Unconfigured or unreachable GrowthBook yields `false`, as does an account
 * that no longer exists, so a gate written with this refuses rather than opens
 * when either side is missing.
 */
export async function isManageAiEnabled(
  user: AuthenticatedManageUser
): Promise<boolean> {
  const featureFlags = getFeatureFlagClient()
  await featureFlags.initialize()
  if (!featureFlags.isEnabled('ai-beta', manageFeatureFlagAttributes(user))) {
    return false
  }

  const account = await prisma.user.findUnique({
    select: { aiFeaturesEnabled: true },
    where: { id: user.sub },
  })

  return account?.aiFeaturesEnabled === true
}

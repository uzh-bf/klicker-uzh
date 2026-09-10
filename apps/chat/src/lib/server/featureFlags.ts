import type {
  AiBetaDecision,
  FeatureFlagAttributes,
} from '@klicker-uzh/feature-flags'
import { NodeFeatureFlagClient } from '@klicker-uzh/feature-flags/node'
import { prisma } from '@klicker-uzh/prisma'
import { getRouteLogger } from '@/src/lib/server/requestLogging'
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
 * An absent account entitlement returns `disabled` before GrowthBook is
 * evaluated. An unavailable GrowthBook answer stays distinct so callers can
 * preserve the AI entry point while refusing requests and asking the client to
 * retry.
 */
export async function getManageAiCapability(
  user: AuthenticatedManageUser
): Promise<AiBetaDecision> {
  const account = await prisma.user.findUnique({
    select: { aiFeaturesEnabled: true, betaEnabled: true },
    where: { id: user.sub },
  })

  if (account?.aiFeaturesEnabled !== true || account.betaEnabled !== true) {
    return 'disabled'
  }

  const featureFlags = getFeatureFlagClient()
  try {
    await featureFlags.initialize()
    return featureFlags.getAiBetaDecision({
      ...manageFeatureFlagAttributes(user),
      betaEnabled: account.betaEnabled,
    })
  } catch {
    getRouteLogger().warn(
      { event: 'chat.feature_flags.unavailable' },
      '[feature-flags] AI beta evaluation failed; temporarily unavailable'
    )
    return 'temporarilyUnavailable'
  }
}

export async function isManageAiEnabled(
  user: AuthenticatedManageUser
): Promise<boolean> {
  return (await getManageAiCapability(user)) === 'enabled'
}

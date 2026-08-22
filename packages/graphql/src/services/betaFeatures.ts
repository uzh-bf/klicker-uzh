import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'

// Beta opt-in is membership in a GrowthBook saved group, not a column in the
// Klicker database. GrowthBook owns the answer so that a targeting rule can
// combine group membership with the Catalyst attribute without the two halves
// living in different systems and drifting apart.
interface BetaFeaturesSettings {
  apiKey: string
  apiUrl: string
  savedGroupId: string
}

// The Management API is a different host from the SDK endpoint: the SDK reads
// a cached payload from the public endpoint, while this writes configuration
// and is reachable only inside the cluster.
function betaFeaturesSettings(): BetaFeaturesSettings | null {
  const apiKey = process.env.GROWTHBOOK_MANAGEMENT_API_KEY
  const apiUrl = process.env.GROWTHBOOK_MANAGEMENT_API_URL
  const savedGroupId = process.env.GROWTHBOOK_BETA_SAVED_GROUP_ID

  if (!apiKey || !apiUrl || !savedGroupId) {
    return null
  }

  return { apiKey, apiUrl: apiUrl.replace(/\/+$/, ''), savedGroupId }
}

const REQUEST_TIMEOUT_MS = 5_000

async function savedGroupRequest(
  settings: BetaFeaturesSettings,
  init?: { body: unknown }
): Promise<string[]> {
  const response = await fetch(
    `${settings.apiUrl}/api/v1/saved-groups/${settings.savedGroupId}`,
    {
      body: init ? JSON.stringify(init.body) : undefined,
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: init ? 'POST' : 'GET',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  )

  if (!response.ok) {
    throw new Error(
      `GrowthBook saved group request failed with status ${response.status}`
    )
  }

  const body = (await response.json()) as {
    savedGroup?: { type?: string; values?: string[] }
  }

  // A condition group has no value list to add anyone to, so a misconfigured
  // group id must fail loudly rather than silently accept every opt-in.
  if (body.savedGroup?.type !== 'list') {
    throw new Error(
      `GrowthBook saved group ${settings.savedGroupId} is not a list group`
    )
  }

  return body.savedGroup.values ?? []
}

/**
 * Whether the lecturer currently sits in the beta saved group.
 *
 * Returns `null` when the integration is unconfigured or GrowthBook cannot be
 * reached. That is deliberately distinct from `false`: the caller must be able
 * to hide the setting rather than tell a lecturer they are opted out when the
 * answer is simply unknown.
 */
export async function getBetaFeatures(
  _args: Record<string, never>,
  ctx: ContextWithUser
): Promise<boolean | null> {
  const settings = betaFeaturesSettings()
  if (!settings) {
    return null
  }

  try {
    const values = await savedGroupRequest(settings)
    return values.includes(ctx.user.sub)
  } catch (error) {
    console.error('Failed to read the GrowthBook beta saved group:', error)
    return null
  }
}

/**
 * Adds or removes the lecturer from the beta saved group.
 *
 * Read-modify-write is safe enough here because opt-in happens at human pace
 * on a group only this mutation writes; a lost update is recoverable by
 * toggling again. GrowthBook's newer revisions API avoids the race but is not
 * present on older self-hosted releases, so this stays on the endpoint every
 * version has.
 */
export async function setBetaFeatures(
  { enabled }: { enabled: boolean },
  ctx: ContextWithUser
): Promise<boolean> {
  const settings = betaFeaturesSettings()
  if (!settings) {
    throw new GraphQLError('Beta access management is not configured')
  }

  const userId = ctx.user.sub

  try {
    const values = await savedGroupRequest(settings)
    const updated = enabled
      ? Array.from(new Set([...values, userId]))
      : values.filter((value) => value !== userId)

    // `bypassApproval` only matters on organizations that require approvals;
    // it is ignored elsewhere, so sending it keeps this working under either
    // configuration without a second code path.
    await savedGroupRequest(settings, {
      body: { bypassApproval: true, values: updated },
    })

    return enabled
  } catch (error) {
    console.error('Failed to update the GrowthBook beta saved group:', error)
    throw new GraphQLError('Failed to update beta access')
  }
}

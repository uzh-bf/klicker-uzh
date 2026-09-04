import { randomUUID } from 'node:crypto'
import { UserLoginScope } from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { Redis } from 'ioredis'
import type { ContextWithUser } from '../lib/context.js'
import { isFeatureFlagEnabled } from '../lib/featureFlags.js'

export interface BetaEnrollmentCapability {
  mayChange: boolean
  membership: boolean | null
  signupAvailable: boolean
}

interface BetaEnrollmentSettings {
  apiKey: string
  apiUrl: string
  savedGroupId: string
}

const REQUEST_TIMEOUT_MS = 3_000
const LOCK_TTL_MS = 10_000
const WRITE_LEASE_MARGIN_MS = 500
const MINIMUM_WRITE_LEASE_MS = REQUEST_TIMEOUT_MS + WRITE_LEASE_MARGIN_MS

const VERIFY_LOCK_LEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) ~= ARGV[1] then
    return -1
  end
  return redis.call("pttl", KEYS[1])
`

const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`

function betaEnrollmentSettings(): BetaEnrollmentSettings | null {
  const apiKey = process.env.GROWTHBOOK_MANAGEMENT_API_KEY
  const apiUrl = process.env.GROWTHBOOK_MANAGEMENT_API_URL
  const savedGroupId = process.env.GROWTHBOOK_BETA_SAVED_GROUP_ID

  if (!apiKey || !apiUrl || !savedGroupId) return null

  try {
    const parsedUrl = new URL(apiUrl)
    const path = parsedUrl.pathname.replace(/\/+$/, '')
    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.search ||
      parsedUrl.hash ||
      !['', '/api', '/api/v1'].includes(path)
    ) {
      return null
    }

    return {
      apiKey,
      apiUrl: `${parsedUrl.origin}${path}`,
      savedGroupId,
    }
  } catch {
    return null
  }
}

function hasFullAccess(ctx: ContextWithUser): boolean {
  return (
    ctx.user.scope === UserLoginScope.ACCOUNT_OWNER ||
    ctx.user.scope === UserLoginScope.FULL_ACCESS
  )
}

function isCatalyst(ctx: ContextWithUser): boolean {
  return ctx.user.catalystInstitutional || ctx.user.catalystIndividual
}

function makeCapability({
  ctx,
  membership,
  signupAvailable,
}: {
  ctx: ContextWithUser
  membership: boolean | null
  signupAvailable: boolean
}): BetaEnrollmentCapability {
  return {
    membership,
    signupAvailable,
    mayChange:
      hasFullAccess(ctx) &&
      (membership === true || (isCatalyst(ctx) && signupAvailable)),
  }
}

function savedGroupUrl(settings: BetaEnrollmentSettings): string {
  const apiBase = settings.apiUrl.endsWith('/api/v1')
    ? settings.apiUrl
    : settings.apiUrl.endsWith('/api')
      ? `${settings.apiUrl}/v1`
      : `${settings.apiUrl}/api/v1`
  return `${apiBase}/saved-groups/${encodeURIComponent(settings.savedGroupId)}`
}

async function readSavedGroup(
  settings: BetaEnrollmentSettings
): Promise<string[]> {
  const response = await fetch(savedGroupUrl(settings), {
    headers: { Authorization: `Bearer ${settings.apiKey}` },
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(
      `GrowthBook saved group read failed with status ${response.status}`
    )
  }

  const body = (await response.json()) as {
    savedGroup?: { type?: string; values?: unknown }
  }

  if (
    body.savedGroup?.type !== 'list' ||
    !Array.isArray(body.savedGroup.values) ||
    !body.savedGroup.values.every((value) => typeof value === 'string')
  ) {
    throw new Error('GrowthBook beta saved group is not a string list')
  }

  return body.savedGroup.values
}

async function writeSavedGroup(
  settings: BetaEnrollmentSettings,
  values: string[]
): Promise<void> {
  const response = await fetch(savedGroupUrl(settings), {
    body: JSON.stringify({ bypassApproval: true, values }),
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(
      `GrowthBook saved group write failed with status ${response.status}`
    )
  }
}

async function releaseLock(redis: Redis, lockKey: string, token: string) {
  try {
    await redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, token)
  } catch (error) {
    console.error('Failed to release the beta enrollment lock:', error)
  }
}

async function updateSavedGroupMembership({
  ctx,
  enabled,
  settings,
}: {
  ctx: ContextWithUser
  enabled: boolean
  settings: BetaEnrollmentSettings
}): Promise<void> {
  const lockKey = `beta-enrollment:saved-group:${settings.savedGroupId}:lock`
  const token = randomUUID()
  let acquired = false

  try {
    acquired =
      (await ctx.redisExec.set(lockKey, token, 'PX', LOCK_TTL_MS, 'NX')) ===
      'OK'
    if (!acquired) {
      throw new Error('Beta enrollment update is already in progress')
    }

    const values = await readSavedGroup(settings)
    const userId = ctx.user.sub
    const alreadyEnabled = values.includes(userId)
    if (alreadyEnabled === enabled) return

    const remainingLease = Number(
      await ctx.redisExec.eval(VERIFY_LOCK_LEASE_SCRIPT, 1, lockKey, token)
    )
    if (remainingLease <= MINIMUM_WRITE_LEASE_MS) {
      throw new Error('Beta enrollment lock lease is no longer safe to write')
    }

    const updated = enabled
      ? Array.from(new Set([...values, userId]))
      : values.filter((value) => value !== userId)
    await writeSavedGroup(settings, updated)
  } finally {
    if (acquired) await releaseLock(ctx.redisExec, lockKey, token)
  }
}

export async function getBetaEnrollment(
  _args: Record<string, never>,
  ctx: ContextWithUser
): Promise<BetaEnrollmentCapability> {
  const signupAvailable = isFeatureFlagEnabled(ctx, 'beta-signup')

  // Read-only and delegated sessions may discover that enrollment exists, but
  // they never cause a control-plane read and cannot infer saved-group state.
  if (!hasFullAccess(ctx)) {
    return makeCapability({
      ctx,
      membership: null,
      signupAvailable,
    })
  }

  const settings = betaEnrollmentSettings()
  if (!settings) {
    return makeCapability({
      ctx,
      membership: null,
      signupAvailable,
    })
  }

  try {
    const values = await readSavedGroup(settings)
    return makeCapability({
      ctx,
      membership: values.includes(ctx.user.sub),
      signupAvailable,
    })
  } catch (error) {
    console.error('Failed to read beta enrollment:', error)
    return makeCapability({
      ctx,
      membership: null,
      signupAvailable,
    })
  }
}

export async function setBetaEnrollment(
  { enabled }: { enabled: boolean },
  ctx: ContextWithUser
): Promise<BetaEnrollmentCapability> {
  if (!hasFullAccess(ctx)) {
    throw new GraphQLError('Beta enrollment requires full account access', {
      extensions: { code: 'FORBIDDEN' },
    })
  }

  const signupAvailable = isFeatureFlagEnabled(ctx, 'beta-signup')
  if (enabled && (!isCatalyst(ctx) || !signupAvailable)) {
    throw new GraphQLError('Beta enrollment is not available', {
      extensions: { code: 'FORBIDDEN' },
    })
  }

  const settings = betaEnrollmentSettings()
  if (!settings) {
    throw new GraphQLError('Beta enrollment is not configured', {
      extensions: { code: 'BETA_ENROLLMENT_UNAVAILABLE' },
    })
  }

  try {
    await updateSavedGroupMembership({ ctx, enabled, settings })
  } catch (error) {
    console.error('Failed to update beta enrollment:', error)
    throw new GraphQLError('Failed to update beta enrollment', {
      extensions: { code: 'BETA_ENROLLMENT_UPDATE_FAILED' },
    })
  }

  try {
    await ctx.featureFlags?.refresh?.()
  } catch (error) {
    // The saved-group write is authoritative. Refresh failure only delays the
    // evaluator payload update until its normal polling interval.
    console.error(
      'Failed to refresh feature flags after beta enrollment:',
      error
    )
  }

  return makeCapability({
    ctx,
    membership: enabled,
    signupAvailable,
  })
}

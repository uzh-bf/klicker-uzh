import {
  GrowthBookClient,
  type GrowthBookPayload,
} from '@growthbook/growthbook'
import type {
  BooleanFeatureFlagKey,
  FeatureFlagAttributes,
  FeatureFlagEnvironment,
  KlickerFeatureFlags,
} from './contracts.js'
import {
  forcedFeatureFlagPayload,
  normalizeFeatureFlagEnvironment,
  sanitizeFeatureFlagAttributes,
} from './contracts.js'

const DEFAULT_TIMEOUT_MS = 2000
const DEFAULT_REFRESH_INTERVAL_MS = 30_000
const DEFAULT_MAX_STALE_MS = 120_000
const AI_BETA_MAX_STALE_MS = 15 * 60_000
const MIN_REFRESH_INTERVAL_MS = 100

type PayloadAvailability = 'unavailable' | 'fresh' | 'bounded-stale' | 'expired'

export type AiBetaDecision = 'enabled' | 'disabled' | 'temporarilyUnavailable'

function normalizeApiHost(
  value: string | undefined,
  environment: FeatureFlagEnvironment
): string | undefined {
  if (!value || value !== value.trim() || /[?#]/.test(value)) return undefined

  try {
    const url = new URL(value)
    const isLocalDevelopmentHost =
      (environment === 'development' || environment === 'test') &&
      (url.hostname === '127.0.0.1' ||
        url.hostname === 'localhost' ||
        url.hostname === '[::1]')
    if (
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && isLocalDevelopmentHost)) ||
      url.search ||
      url.hash
    ) {
      return undefined
    }
    return value.replace(/\/$/, '')
  } catch {
    return undefined
  }
}
function normalizeDuration(
  value: number | undefined,
  fallback: number,
  minimum: number
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.max(minimum, value)
}

export type NodeFeatureFlagClientConfig = {
  apiHost?: string
  clientKey?: string
  environment: string | undefined
  fetch?: typeof globalThis.fetch
  maxStaleMs?: number
  refreshIntervalMs?: number
  // Comma-separated flag keys to force on where no SDK connection exists.
  // See `forcedFeatureFlagPayload` for the environments that honor it.
  forcedOn?: string
  timeoutMs?: number
}

export class NodeFeatureFlagClient<
  Features extends Record<string, unknown> = KlickerFeatureFlags,
> {
  private readonly apiHost: string | undefined
  private readonly client: GrowthBookClient<Features>
  private readonly clientKey: string | undefined
  private readonly configured: boolean
  private readonly environment: ReturnType<
    typeof normalizeFeatureFlagEnvironment
  >
  private readonly fetcher: typeof globalThis.fetch
  private readonly maxStaleMs: number
  private readonly refreshIntervalMs: number
  private readonly timeoutMs: number
  private activeRequest: AbortController | undefined
  private destroyed = false
  private healthy = false
  private initializationPromise: Promise<boolean> | undefined
  private initialized = false
  private lastSuccessfulRefreshAt: number | undefined
  private payloadAvailability: PayloadAvailability | undefined
  // Bounded stale access is limited to sanitized actors whose decision was
  // true while the current payload was fresh. This is process-local state: it
  // is cleared on every successful payload replacement and is never persisted
  // or logged.
  private readonly aiBetaStaleAllowances = new Map<string, number>()
  private refreshPromise: Promise<boolean> | undefined
  private refreshTimer: ReturnType<typeof setInterval> | undefined

  constructor(config: NodeFeatureFlagClientConfig) {
    this.environment = normalizeFeatureFlagEnvironment(config.environment)
    this.apiHost = normalizeApiHost(config.apiHost, this.environment)
    this.clientKey = config.clientKey
    this.configured = Boolean(
      this.environment !== 'unknown' && this.apiHost && this.clientKey
    )
    this.fetcher = config.fetch ?? globalThis.fetch.bind(globalThis)
    this.timeoutMs = normalizeDuration(config.timeoutMs, DEFAULT_TIMEOUT_MS, 1)
    this.refreshIntervalMs =
      config.refreshIntervalMs === 0
        ? 0
        : normalizeDuration(
            config.refreshIntervalMs,
            DEFAULT_REFRESH_INTERVAL_MS,
            MIN_REFRESH_INTERVAL_MS
          )
    this.maxStaleMs = normalizeDuration(
      config.maxStaleMs,
      DEFAULT_MAX_STALE_MS,
      1
    )
    this.client = new GrowthBookClient<Features>()
    if (!this.configured) {
      this.client.initSync({
        payload: {
          features: forcedFeatureFlagPayload(config.forcedOn, this.environment),
        },
      })
    } else {
      this.client.initSync({ payload: { features: {} } })
    }
  }

  async initialize(): Promise<boolean> {
    if (!this.configured || this.destroyed) {
      return false
    }

    if (!this.initializationPromise) {
      this.initializationPromise = this.loadPayload().finally(() => {
        this.initialized = true
        this.startRefreshLoop()
      })
    }

    return this.initializationPromise
  }

  isEnabled(
    key: BooleanFeatureFlagKey<Features>,
    attributes: FeatureFlagAttributes
  ): boolean {
    if (this.configured) this.recordPayloadAvailability()

    if (this.destroyed || (this.configured && !this.hasUsablePayload())) {
      return false
    }

    const result = this.client.evalFeature(key, {
      attributes: sanitizeFeatureFlagAttributes(attributes, this.environment),
    })
    return result.value === true
  }

  getAiBetaDecision(attributes: FeatureFlagAttributes): AiBetaDecision {
    // Development and test can use the explicit local forced payload when no
    // SDK connection exists. A staging or production process never receives
    // that payload, so an unconfigured deployment remains unavailable.
    if (!this.configured) {
      if (this.destroyed) return 'temporarilyUnavailable'

      const result = this.client.evalFeature(
        'ai-beta' as BooleanFeatureFlagKey<Features>,
        {
          attributes: sanitizeFeatureFlagAttributes(
            attributes,
            this.environment
          ),
        }
      )
      return result.value === true ? 'enabled' : 'temporarilyUnavailable'
    }

    const evaluationAttributes = sanitizeFeatureFlagAttributes(
      attributes,
      this.environment
    )
    this.pruneAiBetaStaleAllowances()
    const availability = this.recordPayloadAvailability()
    if (availability === 'unavailable' || availability === 'expired') {
      return 'temporarilyUnavailable'
    }

    const result = this.client.evalFeature(
      'ai-beta' as BooleanFeatureFlagKey<Features>,
      { attributes: evaluationAttributes }
    )

    const actorKey =
      evaluationAttributes.id === undefined
        ? undefined
        : JSON.stringify(evaluationAttributes)

    if (result.value === true) {
      if (availability === 'bounded-stale') {
        if (
          actorKey === undefined ||
          this.aiBetaStaleAllowances.get(actorKey) !==
            this.lastSuccessfulRefreshAt
        ) {
          return 'temporarilyUnavailable'
        }
      } else if (
        availability === 'fresh' &&
        actorKey !== undefined &&
        this.lastSuccessfulRefreshAt !== undefined
      ) {
        this.aiBetaStaleAllowances.set(actorKey, this.lastSuccessfulRefreshAt)
      }

      return 'enabled'
    }

    if (result.value === false) {
      if (actorKey !== undefined) this.aiBetaStaleAllowances.delete(actorKey)
      return 'disabled'
    }

    return 'temporarilyUnavailable'
  }

  getStatus() {
    const usablePayload = this.hasUsablePayload()
    this.recordPayloadAvailability()

    return {
      configured: this.configured,
      environment: this.environment,
      initialized: this.initialized,
      healthy: this.healthy && usablePayload,
      stale: this.configured && !usablePayload,
      lastSuccessfulRefreshAt:
        this.lastSuccessfulRefreshAt !== undefined
          ? new Date(this.lastSuccessfulRefreshAt).toISOString()
          : undefined,
    }
  }

  async refresh(): Promise<void> {
    if (!this.configured || this.destroyed) {
      return
    }

    await this.loadPayload()
  }

  destroy(): void {
    this.destroyed = true
    this.activeRequest?.abort()
    this.activeRequest = undefined

    if (this.refreshTimer !== undefined) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }

    this.aiBetaStaleAllowances.clear()
    this.client.destroy({ destroyAllStreams: true })
  }

  private hasUsablePayload(): boolean {
    return Boolean(
      this.configured &&
        !this.destroyed &&
        this.lastSuccessfulRefreshAt !== undefined &&
        Date.now() - this.lastSuccessfulRefreshAt <= this.maxStaleMs
    )
  }

  private loadPayload(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = this.fetchPayload()
      .then(async (payload) => {
        if (!payload || this.destroyed) {
          return false
        }

        await this.client.setPayload(payload)
        this.aiBetaStaleAllowances.clear()
        this.lastSuccessfulRefreshAt = Date.now()
        this.healthy = true
        this.recordPayloadAvailability()
        return true
      })
      .catch(() => false)
      .then((success) => {
        if (!success) {
          this.healthy = false
          this.recordPayloadAvailability()
        }

        return success
      })
      .finally(() => {
        this.refreshPromise = undefined
      })

    return this.refreshPromise
  }

  private recordPayloadAvailability(): PayloadAvailability {
    const next = this.getPayloadAvailability()
    if (next === this.payloadAvailability) return next

    const previous = this.payloadAvailability
    this.payloadAvailability = next
    const transition =
      next === 'fresh' && previous !== undefined && previous !== 'fresh'
        ? 'recovered'
        : next
    console.warn(`[feature-flags] payload availability: ${transition}`)
    return next
  }

  private getPayloadAvailability(): PayloadAvailability {
    if (
      !this.configured ||
      this.destroyed ||
      this.lastSuccessfulRefreshAt === undefined
    ) {
      return 'unavailable'
    }

    const age = Date.now() - this.lastSuccessfulRefreshAt
    if (age <= DEFAULT_MAX_STALE_MS) return 'fresh'
    if (age <= AI_BETA_MAX_STALE_MS) return 'bounded-stale'
    return 'expired'
  }

  private pruneAiBetaStaleAllowances(): void {
    const refreshAt = this.lastSuccessfulRefreshAt
    const now = Date.now()

    for (const [actorKey, allowanceRefreshAt] of this.aiBetaStaleAllowances) {
      if (
        refreshAt === undefined ||
        allowanceRefreshAt !== refreshAt ||
        now - allowanceRefreshAt > AI_BETA_MAX_STALE_MS
      ) {
        this.aiBetaStaleAllowances.delete(actorKey)
      }
    }
  }

  private async fetchPayload(): Promise<GrowthBookPayload | undefined> {
    const controller = new AbortController()
    this.activeRequest = controller
    let deadline: ReturnType<typeof setTimeout> | undefined

    const request = async () => {
      const response = await this.fetcher(
        `${this.apiHost}/api/features/${this.clientKey}`,
        { redirect: 'error', signal: controller.signal }
      )
      if (!response.ok) {
        throw new Error(`GrowthBook returned HTTP ${response.status}`)
      }

      const payload: unknown = await response.json()
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('features' in payload) ||
        !payload.features ||
        typeof payload.features !== 'object' ||
        Array.isArray(payload.features)
      ) {
        throw new Error('GrowthBook returned an invalid feature payload')
      }

      return payload as GrowthBookPayload
    }

    const timeout = new Promise<never>((_, reject) => {
      deadline = setTimeout(() => {
        controller.abort()
        reject(new Error('GrowthBook request timed out'))
      }, this.timeoutMs)
    })

    try {
      return await Promise.race([request(), timeout])
    } finally {
      if (deadline !== undefined) clearTimeout(deadline)
      if (this.activeRequest === controller) this.activeRequest = undefined
    }
  }

  private startRefreshLoop(): void {
    if (
      this.refreshIntervalMs === 0 ||
      this.refreshTimer !== undefined ||
      this.destroyed
    ) {
      return
    }

    this.refreshTimer = setInterval(() => {
      void this.refresh()
    }, this.refreshIntervalMs)
  }
}

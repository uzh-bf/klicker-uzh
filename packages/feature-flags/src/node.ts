import {
  GrowthBookClient,
  type GrowthBookPayload,
} from '@growthbook/growthbook'
import type {
  BooleanFeatureFlagKey,
  FeatureFlagAttributes,
  KlickerFeatureFlags,
} from './contracts.js'
import {
  normalizeFeatureFlagEnvironment,
  sanitizeFeatureFlagAttributes,
} from './contracts.js'

const DEFAULT_TIMEOUT_MS = 2000
const DEFAULT_REFRESH_INTERVAL_MS = 30_000
const DEFAULT_MAX_STALE_MS = 120_000
const MIN_REFRESH_INTERVAL_MS = 100

function normalizeApiHost(value: string | undefined): string | undefined {
  if (!value) return undefined

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return undefined
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
  private refreshPromise: Promise<boolean> | undefined
  private refreshTimer: ReturnType<typeof setInterval> | undefined

  constructor(config: NodeFeatureFlagClientConfig) {
    this.environment = normalizeFeatureFlagEnvironment(config.environment)
    this.apiHost = normalizeApiHost(config.apiHost)
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
    this.client.initSync({ payload: { features: {} } })
  }

  async initialize(): Promise<boolean> {
    if (!this.configured || this.destroyed) {
      return false
    }

    if (!this.initializationPromise) {
      this.initializationPromise = this.loadPayload('initialization').finally(
        () => {
          this.initialized = true
          this.startRefreshLoop()
        }
      )
    }

    return this.initializationPromise
  }

  isEnabled(
    key: BooleanFeatureFlagKey<Features>,
    attributes: FeatureFlagAttributes
  ): boolean {
    if (this.destroyed || (this.configured && !this.hasUsablePayload())) {
      return false
    }

    const result = this.client.evalFeature(key, {
      attributes: sanitizeFeatureFlagAttributes(attributes, this.environment),
    })
    return result.value === true
  }

  getStatus() {
    const usablePayload = this.hasUsablePayload()

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

    await this.loadPayload('refresh')
  }

  destroy(): void {
    this.destroyed = true
    this.activeRequest?.abort()
    this.activeRequest = undefined

    if (this.refreshTimer !== undefined) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }

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

  private loadPayload(reason: 'initialization' | 'refresh'): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = this.fetchPayload()
      .then(async (payload) => {
        if (!payload || this.destroyed) {
          return false
        }

        await this.client.setPayload(payload)
        this.lastSuccessfulRefreshAt = Date.now()
        this.healthy = true
        return true
      })
      .catch(() => false)
      .then((success) => {
        if (!success) {
          this.healthy = false
          if (!this.destroyed) {
            console.warn(
              reason === 'initialization'
                ? '[feature-flags] Node initialization failed; using false fallbacks'
                : '[feature-flags] Node refresh failed; retaining the bounded cached payload'
            )
          }
        }

        return success
      })
      .finally(() => {
        this.refreshPromise = undefined
      })

    return this.refreshPromise
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

import { GrowthBookClient } from '@growthbook/growthbook'
import type {
  BooleanFeatureFlagKey,
  FeatureFlagAttributes,
  KlickerFeatureFlags,
} from './contracts.js'
import {
  normalizeFeatureFlagEnvironment,
  sanitizeFeatureFlagAttributes,
} from './contracts.js'

export type NodeFeatureFlagClientConfig = {
  apiHost?: string
  clientKey?: string
  environment: string | undefined
  timeoutMs?: number
}

export class NodeFeatureFlagClient<
  Features extends Record<string, unknown> = KlickerFeatureFlags,
> {
  private readonly client: GrowthBookClient<Features>
  private readonly configured: boolean
  private readonly environment: ReturnType<
    typeof normalizeFeatureFlagEnvironment
  >
  private readonly timeoutMs: number
  private initializationPromise: Promise<boolean> | undefined
  private initialized = false
  private healthy = false

  constructor(config: NodeFeatureFlagClientConfig) {
    this.environment = normalizeFeatureFlagEnvironment(config.environment)
    this.configured = Boolean(
      this.environment !== 'unknown' && config.apiHost && config.clientKey
    )
    this.timeoutMs = config.timeoutMs ?? 2000
    this.client = new GrowthBookClient<Features>(
      this.configured
        ? {
            apiHost: config.apiHost,
            clientKey: config.clientKey,
          }
        : undefined
    )

    if (!this.configured) {
      this.client.initSync({ payload: { features: {} } })
    }
  }

  async initialize(): Promise<boolean> {
    if (!this.configured) {
      return false
    }

    if (!this.initializationPromise) {
      this.initializationPromise = this.client
        .init({ timeout: this.timeoutMs })
        .then((result) => {
          this.initialized = true
          this.healthy = result.success
          if (!result.success) {
            console.warn(
              '[feature-flags] Node initialization failed; using false fallbacks'
            )
          }
          return result.success
        })
        .catch(() => {
          this.initialized = true
          this.healthy = false
          console.warn(
            '[feature-flags] Node initialization failed; using false fallbacks'
          )
          return false
        })
    }

    return this.initializationPromise
  }

  isEnabled(
    key: BooleanFeatureFlagKey<Features>,
    attributes: FeatureFlagAttributes
  ): boolean {
    return this.client.isOn(key, {
      attributes: sanitizeFeatureFlagAttributes(attributes, this.environment),
    })
  }

  getStatus() {
    return {
      configured: this.configured,
      environment: this.environment,
      initialized: this.initialized,
      healthy: this.healthy,
    }
  }

  async refresh(): Promise<void> {
    if (!this.configured) {
      return
    }

    const previousPayload = this.client.getPayload()

    try {
      const result = await this.client.init({
        skipCache: true,
        timeout: this.timeoutMs,
      })
      if (result.success) {
        this.healthy = true
        return
      }

      await this.client.setPayload(previousPayload)
      this.healthy = false
      console.warn(
        '[feature-flags] Node refresh failed; retaining the last usable payload'
      )
    } catch (error) {
      await this.client.setPayload(previousPayload)
      this.healthy = false
      console.warn(
        '[feature-flags] Node refresh failed; retaining the last usable payload'
      )
      throw error
    }
  }
}

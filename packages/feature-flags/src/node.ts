import { GrowthBookClient } from '@growthbook/growthbook'
import type {
  BooleanFeatureFlagKey,
  FeatureFlagAttributes,
  KlickerFeatureFlags,
} from './contracts.js'

export type NodeFeatureFlagClientConfig = {
  apiHost?: string
  clientKey?: string
  timeoutMs?: number
}

export class NodeFeatureFlagClient<
  Features extends Record<string, unknown> = KlickerFeatureFlags,
> {
  private readonly client: GrowthBookClient<Features>
  private readonly configured: boolean
  private readonly timeoutMs: number

  constructor(config: NodeFeatureFlagClientConfig) {
    this.configured = Boolean(config.apiHost && config.clientKey)
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

    const result = await this.client.init({ timeout: this.timeoutMs })
    return result.success
  }

  isEnabled(
    key: BooleanFeatureFlagKey<Features>,
    attributes: FeatureFlagAttributes
  ): boolean {
    return this.client.isOn(key, { attributes })
  }

  async refresh(): Promise<void> {
    if (!this.configured) {
      return
    }

    await this.client.refreshFeatures()
  }
}

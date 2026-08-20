import { GrowthBook } from '@growthbook/growthbook'
import {
  normalizeFeatureFlagEnvironment,
  sanitizeFeatureFlagAttributes,
} from './contracts.js'

export type BrowserFeatureFlagConfig = {
  apiHost?: string
  clientKey?: string
  environment: string | undefined
  timeoutMs?: number
}

export function createBrowserFeatureFlagClient<
  Features extends Record<string, unknown>,
>(config: BrowserFeatureFlagConfig) {
  const environment = normalizeFeatureFlagEnvironment(config.environment)
  const configured = Boolean(
    environment !== 'unknown' && config.apiHost && config.clientKey
  )
  const growthbook = new GrowthBook<Features>(
    configured
      ? {
          apiHost: config.apiHost,
          clientKey: config.clientKey,
        }
      : undefined
  )
  let initializePromise: Promise<boolean> | undefined

  const initialize = (): Promise<boolean> => {
    if (!initializePromise) {
      if (configured) {
        initializePromise = growthbook
          .init({ timeout: config.timeoutMs ?? 2000 })
          .then((result) => {
            if (!result.success) {
              console.warn(
                '[feature-flags] browser initialization failed; using false fallbacks'
              )
            }
            return result.success
          })
          .catch(() => {
            console.warn(
              '[feature-flags] browser initialization failed; using false fallbacks'
            )
            return false
          })
      } else {
        growthbook.initSync({ payload: { features: {} } })
        initializePromise = Promise.resolve(false)
      }
    }

    return initializePromise
  }

  const setAttributes = (attributes: unknown) =>
    growthbook.setAttributes(
      sanitizeFeatureFlagAttributes(attributes, environment)
    )

  return { environment, growthbook, initialize, setAttributes }
}

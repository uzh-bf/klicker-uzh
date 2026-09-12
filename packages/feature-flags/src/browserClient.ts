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
          disableExperimentsOnLoad: true,
          disableVisualExperiments: true,
          disableJsInjection: true,
          disableUrlRedirectExperiments: true,
          disableCrossOriginUrlRedirectExperiments: true,
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
                '[feature-flags] Browser initialization failed; using false fallbacks'
              )
            }
            return result.success
          })
          .catch(() => {
            console.warn(
              '[feature-flags] Browser initialization failed; using false fallbacks'
            )
            return false
          })
      } else {
        growthbook.initSync({ payload: { features: {} } })
        if (environment !== 'unknown') {
          console.warn(
            '[feature-flags] Browser configuration is incomplete; using false fallbacks'
          )
        }
        initializePromise = Promise.resolve(false)
      }
    }

    return initializePromise
  }

  const setAttributes = (attributes: unknown) =>
    growthbook.setAttributes(
      sanitizeFeatureFlagAttributes(attributes, environment)
    )

  const refresh = async (): Promise<boolean> => {
    if (!configured) return false

    try {
      await initialize()
      const result = await growthbook.init({
        skipCache: true,
        streaming: false,
        timeout: config.timeoutMs ?? 2000,
      })
      if (!result.success) {
        console.warn(
          '[feature-flags] Browser refresh failed; keeping the last usable payload'
        )
      }
      return result.success
    } catch {
      console.warn(
        '[feature-flags] Browser refresh failed; keeping the last usable payload'
      )
      return false
    }
  }

  return { environment, growthbook, initialize, refresh, setAttributes }
}

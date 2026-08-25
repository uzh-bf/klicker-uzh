import { GrowthBook } from '@growthbook/growthbook'
import {
  forcedFeatureFlagPayload,
  normalizeFeatureFlagEnvironment,
  sanitizeFeatureFlagAttributes,
} from './contracts.js'

export type BrowserFeatureFlagConfig = {
  apiHost?: string
  clientKey?: string
  environment: string | undefined
  // Comma-separated flag keys to force on where no SDK connection exists.
  // See `forcedFeatureFlagPayload` for the environments that honor it.
  forcedOn?: string
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
        const forcedFeatures = forcedFeatureFlagPayload(
          config.forcedOn,
          environment
        )
        growthbook.initSync({
          payload: {
            features: forcedFeatures,
          },
        })
        if (
          environment !== 'unknown' &&
          Object.keys(forcedFeatures).length === 0
        ) {
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

  return { environment, growthbook, initialize, setAttributes }
}

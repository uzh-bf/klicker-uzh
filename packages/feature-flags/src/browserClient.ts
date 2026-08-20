import { GrowthBook } from '@growthbook/growthbook'
import { normalizeFeatureFlagEnvironment } from './contracts.js'

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
          .then((result) => result.success)
          .catch(() => false)
      } else {
        growthbook.initSync({ payload: { features: {} } })
        initializePromise = Promise.resolve(false)
      }
    }

    return initializePromise
  }

  return { environment, growthbook, initialize }
}

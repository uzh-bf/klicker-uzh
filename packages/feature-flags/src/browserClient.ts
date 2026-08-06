import { GrowthBook } from '@growthbook/growthbook'

export type BrowserFeatureFlagConfig = {
  apiHost?: string
  clientKey?: string
  timeoutMs?: number
}

export function createBrowserFeatureFlagClient<
  Features extends Record<string, unknown>,
>(config: BrowserFeatureFlagConfig) {
  const configured = Boolean(config.apiHost && config.clientKey)
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
          .then((result) => result.success)
          .catch(() => false)
      } else {
        growthbook.initSync({ payload: { features: {} } })
        initializePromise = Promise.resolve(false)
      }
    }

    return initializePromise
  }

  return { growthbook, initialize }
}

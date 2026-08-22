import {
  GrowthBookProvider,
  useFeatureIsOn,
} from '@growthbook/growthbook-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import {
  type BrowserFeatureFlagConfig,
  createBrowserFeatureFlagClient,
} from './browserClient.js'
import type {
  FeatureFlagAttributes,
  FeatureFlagKey,
  KlickerFeatureFlags,
} from './contracts.js'

export type { BrowserFeatureFlagConfig } from './browserClient.js'

type FeatureFlagProviderProps = {
  attributes: FeatureFlagAttributes
  config: BrowserFeatureFlagConfig
  children: ReactNode
}

export function FeatureFlagProvider({
  attributes,
  config,
  children,
}: FeatureFlagProviderProps) {
  const [{ environment, growthbook, initialize }] = useState(() =>
    createBrowserFeatureFlagClient<KlickerFeatureFlags>(config)
  )
  const destroyTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  useEffect(() => {
    void growthbook.setAttributes({ ...attributes, environment })
  }, [attributes, environment, growthbook])

  useEffect(() => {
    if (destroyTimeout.current !== undefined) {
      clearTimeout(destroyTimeout.current)
      destroyTimeout.current = undefined
    }

    void initialize()

    return () => {
      // React Strict Mode immediately repeats effect setup after cleanup in
      // development. Delay destruction by one task so that setup can cancel it.
      destroyTimeout.current = setTimeout(() => {
        growthbook.destroy()
        destroyTimeout.current = undefined
      })
    }
  }, [growthbook, initialize])

  return (
    <GrowthBookProvider growthbook={growthbook}>{children}</GrowthBookProvider>
  )
}

export function useFeatureFlag(key: FeatureFlagKey): boolean {
  return useFeatureIsOn<KlickerFeatureFlags>(key)
}

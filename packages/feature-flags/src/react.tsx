import {
  GrowthBookProvider,
  useFeatureIsOn,
} from '@growthbook/growthbook-react'
import { type ReactNode, useEffect, useState } from 'react'
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
  const [{ growthbook, initialize }] = useState(() =>
    createBrowserFeatureFlagClient<KlickerFeatureFlags>(config)
  )

  useEffect(() => {
    void growthbook.setAttributes(attributes)
  }, [attributes, growthbook])

  useEffect(() => {
    void initialize()
  }, [initialize])

  return (
    <GrowthBookProvider growthbook={growthbook}>{children}</GrowthBookProvider>
  )
}

export function useFeatureFlag(key: FeatureFlagKey): boolean {
  return useFeatureIsOn<KlickerFeatureFlags>(key)
}

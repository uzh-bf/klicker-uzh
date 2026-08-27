import {
  GrowthBookProvider,
  useFeatureIsOn,
  useGrowthBook,
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
import { evaluateFeatureFlags } from './contracts.js'

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
  const [{ growthbook, initialize, setAttributes }] = useState(() =>
    createBrowserFeatureFlagClient<KlickerFeatureFlags>(config)
  )
  const destroyTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  useEffect(() => {
    void setAttributes(attributes)
  }, [attributes, setAttributes])

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

/**
 * Evaluates a whole set of flags with a single hook call, for callers whose key
 * list is data-driven — one `useFeatureFlag` per list entry would break the
 * rules-of-hooks lint rule.
 *
 * Reactivity is identical to `useFeatureFlag`: `useFeatureIsOn` is itself only
 * `useGrowthBook().isOn(key)`, and `GrowthBookProvider` re-renders its subtree
 * when the feature payload arrives. The returned object is a fresh value on
 * every render, so callers must not use it directly as an effect dependency.
 */
export function useFeatureFlags(
  keys: readonly FeatureFlagKey[]
): Partial<Record<FeatureFlagKey, boolean>> {
  const growthbook = useGrowthBook<KlickerFeatureFlags>()

  return evaluateFeatureFlags(growthbook, keys)
}

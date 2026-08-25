import {
  GrowthBookProvider,
  useFeatureIsOn,
} from '@growthbook/growthbook-react'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
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

const FeatureFlagsReadyContext = createContext(false)

type FeatureFlagProviderProps = {
  attributes: FeatureFlagAttributes
  attributesReady?: boolean
  config: BrowserFeatureFlagConfig
  children: ReactNode
}

export function FeatureFlagProvider({
  attributes,
  attributesReady = true,
  config,
  children,
}: FeatureFlagProviderProps) {
  const [{ growthbook, initialize, setAttributes }] = useState(() =>
    createBrowserFeatureFlagClient<KlickerFeatureFlags>(config)
  )
  const destroyTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const [initializationSettled, setInitializationSettled] = useState(false)
  const [appliedAttributes, setAppliedAttributes] = useState<
    FeatureFlagAttributes | undefined
  >(undefined)

  useEffect(() => {
    let active = true

    void setAttributes(attributes)
      .then(() => {
        if (active) setAppliedAttributes(attributes)
      })
      .catch(() => {
        console.warn(
          '[feature-flags] Browser attributes could not be applied; keeping routes unavailable'
        )
      })

    return () => {
      active = false
    }
  }, [attributes, setAttributes])

  useEffect(() => {
    let active = true

    if (destroyTimeout.current !== undefined) {
      clearTimeout(destroyTimeout.current)
      destroyTimeout.current = undefined
    }

    void initialize().finally(() => {
      if (active) setInitializationSettled(true)
    })

    return () => {
      active = false
      // React Strict Mode immediately repeats effect setup after cleanup in
      // development. Delay destruction by one task so that setup can cancel it.
      destroyTimeout.current = setTimeout(() => {
        growthbook.destroy()
        destroyTimeout.current = undefined
      })
    }
  }, [growthbook, initialize])

  return (
    <FeatureFlagsReadyContext.Provider
      value={
        attributesReady &&
        initializationSettled &&
        appliedAttributes === attributes
      }
    >
      <GrowthBookProvider growthbook={growthbook}>
        {children}
      </GrowthBookProvider>
    </FeatureFlagsReadyContext.Provider>
  )
}

export function useFeatureFlag(key: FeatureFlagKey): boolean {
  return useFeatureIsOn<KlickerFeatureFlags>(key)
}

export function useFeatureFlagsReady(): boolean {
  return useContext(FeatureFlagsReadyContext)
}

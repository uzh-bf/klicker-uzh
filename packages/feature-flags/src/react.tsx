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
const FeatureFlagEvaluationAvailableContext = createContext(true)

type FeatureFlagProviderProps = {
  attributes: FeatureFlagAttributes
  attributesReady?: boolean
  config: BrowserFeatureFlagConfig
  children: ReactNode
  evaluationAvailable?: boolean
}

export function FeatureFlagProvider({
  attributes,
  attributesReady = true,
  config,
  children,
  evaluationAvailable = true,
}: FeatureFlagProviderProps) {
  const [{ growthbook, initialize, setAttributes }] = useState(() =>
    createBrowserFeatureFlagClient<KlickerFeatureFlags>(config)
  )
  const destroyTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const [initializationSettled, setInitializationSettled] = useState(false)
  const [attributeApplication, setAttributeApplication] = useState<
    | {
        attributes: FeatureFlagAttributes
        available: boolean
      }
    | undefined
  >(undefined)

  useEffect(() => {
    let active = true

    void setAttributes(attributes)
      .then(() => {
        if (active) {
          setAttributeApplication({ attributes, available: true })
        }
      })
      .catch(() => {
        console.warn(
          '[feature-flags] Browser attributes could not be applied; keeping routes unavailable'
        )
        if (active) {
          setAttributeApplication({ attributes, available: false })
        }
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

  const attributesSettled = attributeApplication?.attributes === attributes
  const attributesAvailable = attributesSettled
    ? attributeApplication?.available === true
    : true
  const effectiveEvaluationAvailable =
    evaluationAvailable && attributesAvailable

  return (
    <FeatureFlagsReadyContext.Provider
      value={
        !evaluationAvailable ||
        (attributesSettled &&
          (!attributesAvailable || (attributesReady && initializationSettled)))
      }
    >
      <FeatureFlagEvaluationAvailableContext.Provider
        value={effectiveEvaluationAvailable}
      >
        <GrowthBookProvider growthbook={growthbook}>
          {children}
        </GrowthBookProvider>
      </FeatureFlagEvaluationAvailableContext.Provider>
    </FeatureFlagsReadyContext.Provider>
  )
}

export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const enabled = useFeatureIsOn<KlickerFeatureFlags>(key)
  const evaluationAvailable = useContext(FeatureFlagEvaluationAvailableContext)

  return evaluationAvailable && enabled
}

export function useFeatureFlagsReady(): boolean {
  return useContext(FeatureFlagsReadyContext)
}

export function useFeatureFlagEvaluationAvailable(): boolean {
  return useContext(FeatureFlagEvaluationAvailableContext)
}

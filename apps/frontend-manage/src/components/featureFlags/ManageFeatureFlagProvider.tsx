import { useQuery } from '@apollo/client'
import type { FeatureFlagAttributes } from '@klicker-uzh/feature-flags'
import {
  type BrowserFeatureFlagConfig,
  FeatureFlagProvider,
} from '@klicker-uzh/feature-flags/react'
import {
  ManageAiCapabilityState as GraphQLManageAiCapabilityState,
  ManageAiCapabilityDocument,
  ManageFeatureFlagProfileDocument,
  type ManageFeatureFlagProfileQuery,
  ManageFeaturePreferencesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { isPublicLiveQuizEvaluationRoute } from '../../lib/isPublicLiveQuizEvaluationRoute'

interface ManageFeatureFlagProviderProps {
  children: ReactNode
}

export type ManageAiCapability =
  | 'enabled'
  | 'disabled'
  | 'temporarilyUnavailable'
  | 'unresolved'

interface ManageAiCapabilityContextValue {
  state: ManageAiCapability
  betaEnabled: boolean
  retry: () => Promise<void>
  confirmBetaPreference: (enabled: boolean) => void
}

const ManageAiCapabilityContext = createContext<ManageAiCapabilityContextValue>(
  {
    state: 'unresolved',
    betaEnabled: false,
    retry: async () => undefined,
    confirmBetaPreference: () => undefined,
  }
)

export function useManageAiCapability(): ManageAiCapabilityContextValue {
  return useContext(ManageAiCapabilityContext)
}

const config = {
  apiHost: process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST,
  clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY,
  environment: process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV,
  forcedOn: process.env.NEXT_PUBLIC_FEATURE_FLAGS_FORCED_ON,
} satisfies BrowserFeatureFlagConfig

function ManageFeatureFlagProvider({
  children,
}: ManageFeatureFlagProviderProps) {
  const router = useRouter()
  const skipUserProfile = isPublicLiveQuizEvaluationRoute(router)
  const {
    data,
    error: userProfileError,
    loading,
  } = useQuery(ManageFeatureFlagProfileDocument, {
    // Other profile queries must not replace a failed identity resolution with
    // a shared-cache update before this query succeeds.
    fetchPolicy: 'no-cache',
    errorPolicy: 'all',
    // HMAC evaluation links are public. An identity query on those links would
    // trigger Apollo's global Unauthorized redirect before the page can load.
    skip: skipUserProfile,
  })
  // Never carry a cached profile into a new or failed authentication state.
  // The capability controller is keyed by this identity, so it also starts with
  // no previous capability while Apollo resolves the next profile.
  const user = loading || userProfileError ? undefined : data?.userProfile
  const userId = user?.id
  const userRole = user?.role
  const userProfileUnavailable =
    !skipUserProfile && !loading && (Boolean(userProfileError) || !userId)
  const profileReady = !loading && !userProfileError && Boolean(userId)
  const userCatalyst = user?.catalyst
  const { data: preferences } = useQuery(ManageFeaturePreferencesDocument, {
    fetchPolicy: 'cache-and-network',
    skip: skipUserProfile || !profileReady,
  })
  const [confirmedOptOut, setConfirmedOptOut] = useState<string>()
  const confirmBetaPreference = useCallback(
    (enabled: boolean) => {
      if (!userId) return
      setConfirmedOptOut(enabled ? undefined : userId)
    },
    [userId]
  )
  const preferenceUser =
    userId && preferences?.userProfile?.id === userId
      ? preferences.userProfile
      : undefined
  const betaEnabled =
    confirmedOptOut !== userId && preferenceUser?.betaEnabled === true
  const attributes = useMemo<FeatureFlagAttributes>(
    () =>
      userId
        ? {
            id: userId,
            actorType: 'user',
            role: userRole,
            catalyst: Boolean(userCatalyst),
            betaEnabled: betaEnabled === true,
          }
        : { actorType: 'anonymous' },
    [userCatalyst, userId, userRole, betaEnabled]
  )

  return (
    <FeatureFlagProvider
      config={config}
      attributes={attributes}
      attributesReady={
        skipUserProfile || Boolean(userId) || userProfileUnavailable
      }
      evaluationAvailable={skipUserProfile || profileReady}
    >
      <ManageAiCapabilityProvider
        loadingProfile={loading}
        skipUserProfile={skipUserProfile || router.pathname === '/login'}
        user={user}
        betaEnabled={betaEnabled}
        confirmBetaPreference={confirmBetaPreference}
      >
        {children}
      </ManageAiCapabilityProvider>
    </FeatureFlagProvider>
  )
}

type ManageAiCapabilityProviderProps = {
  children: ReactNode
  loadingProfile: boolean
  skipUserProfile: boolean
  user: ManageFeatureFlagProfileQuery['userProfile'] | undefined
  betaEnabled: boolean
  confirmBetaPreference: (enabled: boolean) => void
}

const RETRY_BASE_DELAY_MS = 1000
const RETRY_MAX_DELAY_MS = 60_000

function ManageAiCapabilityProvider({
  children,
  ...props
}: ManageAiCapabilityProviderProps) {
  const identity = JSON.stringify([
    props.user?.id,
    props.user?.role,
    props.user?.catalyst,
    props.skipUserProfile,
    props.user?.aiFeaturesEnabled,
    props.betaEnabled,
  ])
  const [scope, setScope] = useState({ identity, generation: 0 })
  const [snapshot, setSnapshot] = useState<{
    generation: number
    value: ManageAiCapabilityContextValue
  }>()
  if (scope.identity !== identity) {
    // Reset before rendering consumers, including a return to the same actor.
    setScope({ identity, generation: scope.generation + 1 })
    setSnapshot(undefined)
  }
  const publish = useCallback(
    (value: ManageAiCapabilityContextValue) => {
      setSnapshot({ generation: scope.generation, value })
    },
    [scope.generation]
  )
  const current = snapshot?.generation === scope.generation
  const value: ManageAiCapabilityContextValue = current
    ? snapshot.value
    : {
        state:
          props.loadingProfile ||
          (!props.skipUserProfile &&
            Boolean(props.user?.id) &&
            props.user?.aiFeaturesEnabled === true &&
            props.betaEnabled)
            ? 'unresolved'
            : 'disabled',
        betaEnabled: props.betaEnabled,
        retry: async () => undefined,
        confirmBetaPreference: props.confirmBetaPreference,
      }

  return (
    <ManageAiCapabilityContext.Provider value={value}>
      <ManageAiCapabilityController
        key={scope.generation}
        {...props}
        publish={publish}
      />
      {children}
    </ManageAiCapabilityContext.Provider>
  )
}

function ManageAiCapabilityController({
  loadingProfile,
  skipUserProfile,
  user,
  betaEnabled,
  confirmBetaPreference,
  publish,
}: Omit<ManageAiCapabilityProviderProps, 'children'> & {
  publish: (value: ManageAiCapabilityContextValue) => void
}) {
  const hasEntitlement = user?.aiFeaturesEnabled === true && betaEnabled
  const shouldQuery = !skipUserProfile && Boolean(user?.id) && hasEntitlement
  const {
    data: capabilityData,
    error: capabilityError,
    loading: capabilityLoading,
    refetch: refetchCapability,
  } = useQuery(ManageAiCapabilityDocument, {
    errorPolicy: 'all',
    // This field has no actor variable. Neither cache reuse nor request
    // deduplication may transfer a decision across authentication lifetimes.
    fetchPolicy: 'no-cache',
    context: { queryDeduplication: false },
    notifyOnNetworkStatusChange: true,
    skip: !shouldQuery,
  })
  const [lastAuthoritativeState, setLastAuthoritativeState] = useState<
    Exclude<ManageAiCapability, 'unresolved'> | undefined
  >(undefined)
  const authenticationExpired = capabilityError?.graphQLErrors.some(
    ({ message }) => message === 'Unauthorized'
  )
  const canRefetch = shouldQuery && !authenticationExpired

  const state = useMemo<ManageAiCapability>(() => {
    if (skipUserProfile || !user?.id) {
      return loadingProfile ? 'unresolved' : 'disabled'
    }

    if (!hasEntitlement) return 'disabled'
    if (authenticationExpired) return 'disabled'
    if (capabilityError) return 'temporarilyUnavailable'
    if (capabilityLoading) return lastAuthoritativeState ?? 'unresolved'

    switch (capabilityData?.manageAiCapability) {
      case GraphQLManageAiCapabilityState.Enabled:
        return 'enabled'
      case GraphQLManageAiCapabilityState.Disabled:
        return 'disabled'
      case GraphQLManageAiCapabilityState.TemporarilyUnavailable:
        return 'temporarilyUnavailable'
      default:
        return 'temporarilyUnavailable'
    }
  }, [
    capabilityData?.manageAiCapability,
    capabilityError,
    capabilityLoading,
    authenticationExpired,
    hasEntitlement,
    lastAuthoritativeState,
    loadingProfile,
    skipUserProfile,
    user?.id,
  ])

  useEffect(() => {
    if (!hasEntitlement) {
      setLastAuthoritativeState(undefined)
      return
    }
    if (!capabilityLoading && !capabilityError && state !== 'unresolved') {
      setLastAuthoritativeState(state)
    }
  }, [capabilityError, capabilityLoading, hasEntitlement, state])

  const retryAttemptRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const retryingRef = useRef(false)

  const refetchSafely = useCallback(async () => {
    if (!canRefetch || retryingRef.current) return

    retryingRef.current = true
    try {
      await refetchCapability()
    } catch {
      // The capability state is derived from Apollo's error result. A failed
      // refetch must not surface an unhandled promise rejection from a
      // background recovery attempt.
    } finally {
      retryingRef.current = false
    }
  }, [refetchCapability, canRefetch])

  const retry = useCallback(async () => {
    if (state !== 'temporarilyUnavailable' || !canRefetch) return

    retryAttemptRef.current = 0
    await refetchSafely()
  }, [refetchSafely, canRefetch, state])

  useEffect(() => {
    if (state !== 'temporarilyUnavailable' || !canRefetch) {
      retryAttemptRef.current = 0
      if (retryTimerRef.current !== undefined) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = undefined
      }
      return
    }

    if (capabilityLoading) {
      if (retryTimerRef.current !== undefined) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = undefined
      }
      return
    }

    const attempt = retryAttemptRef.current
    const exponentialDelay = Math.min(
      RETRY_MAX_DELAY_MS,
      RETRY_BASE_DELAY_MS * 2 ** Math.min(attempt, 6)
    )
    const jitteredDelay = Math.min(
      RETRY_MAX_DELAY_MS,
      Math.round(exponentialDelay * (0.5 + Math.random()))
    )

    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = undefined
      retryAttemptRef.current = attempt + 1
      void refetchSafely()
    }, jitteredDelay)

    return () => {
      if (retryTimerRef.current !== undefined) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = undefined
      }
    }
  }, [capabilityLoading, refetchSafely, canRefetch, state])

  useEffect(() => {
    if (!canRefetch) return

    const recover = () => {
      void refetchSafely()
    }
    window.addEventListener('focus', recover)
    window.addEventListener('online', recover)
    return () => {
      window.removeEventListener('focus', recover)
      window.removeEventListener('online', recover)
    }
  }, [refetchSafely, canRefetch])

  const contextValue = useMemo(
    () => ({ state, retry, confirmBetaPreference, betaEnabled }),
    [retry, state, confirmBetaPreference, betaEnabled]
  )

  useEffect(() => {
    publish(contextValue)
  }, [contextValue, publish])

  return null
}

export default ManageFeatureFlagProvider

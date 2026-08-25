import { useQuery } from '@apollo/client'
import type { FeatureFlagAttributes } from '@klicker-uzh/feature-flags'
import {
  type BrowserFeatureFlagConfig,
  FeatureFlagProvider,
} from '@klicker-uzh/feature-flags/react'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import { type ReactNode, useMemo } from 'react'

interface ManageFeatureFlagProviderProps {
  children: ReactNode
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
  const skipUserProfile =
    router.pathname === '/quizzes/[id]/evaluation' &&
    (!router.isReady || router.query.hmac !== undefined)
  const { data, loading } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'ignore',
    // HMAC evaluation links are public. An identity query on those links would
    // trigger Apollo's global Unauthorized redirect before the page can load.
    skip: skipUserProfile,
  })
  const user = data?.userProfile
  const userId = user?.id
  const userRole = user?.role
  const userProfileUnavailable = !skipUserProfile && !loading && !userId
  const userCatalyst = user?.catalyst
  const attributes = useMemo<FeatureFlagAttributes>(
    () =>
      userId
        ? {
            id: userId,
            actorType: 'user',
            role: userRole,
            catalyst: Boolean(userCatalyst),
          }
        : { actorType: 'anonymous' },
    [userCatalyst, userId, userRole]
  )

  return (
    <FeatureFlagProvider
      config={config}
      attributes={attributes}
      attributesReady={
        skipUserProfile || Boolean(userId) || userProfileUnavailable
      }
      evaluationAvailable={!userProfileUnavailable}
    >
      {children}
    </FeatureFlagProvider>
  )
}

export default ManageFeatureFlagProvider

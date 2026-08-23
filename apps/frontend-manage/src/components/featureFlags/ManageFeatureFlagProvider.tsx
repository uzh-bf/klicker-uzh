import { useQuery } from '@apollo/client'
import type { FeatureFlagAttributes } from '@klicker-uzh/feature-flags'
import {
  type BrowserFeatureFlagConfig,
  FeatureFlagProvider,
} from '@klicker-uzh/feature-flags/react'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import { type ReactNode, useMemo } from 'react'

interface ManageFeatureFlagProviderProps {
  children: ReactNode
}

const config = {
  apiHost: process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST,
  clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY,
  environment: process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV,
} satisfies BrowserFeatureFlagConfig

function ManageFeatureFlagProvider({
  children,
}: ManageFeatureFlagProviderProps) {
  const { data } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-and-network',
  })
  const user = data?.userProfile
  const userId = user?.id
  const userRole = user?.role
  const attributes = useMemo<FeatureFlagAttributes>(
    () =>
      userId
        ? {
            id: userId,
            actorType: 'user',
            role: userRole,
          }
        : { actorType: 'anonymous' },
    [userId, userRole]
  )

  return (
    <FeatureFlagProvider config={config} attributes={attributes}>
      {children}
    </FeatureFlagProvider>
  )
}

export default ManageFeatureFlagProvider

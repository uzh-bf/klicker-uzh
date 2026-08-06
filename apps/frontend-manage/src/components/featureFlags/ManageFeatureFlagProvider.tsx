import {
  type FeatureFlagAttributes,
  normalizeFeatureFlagEnvironment,
} from '@klicker-uzh/feature-flags'
import { FeatureFlagProvider } from '@klicker-uzh/feature-flags/react'
import type { UserProfileQuery } from '@klicker-uzh/graphql/dist/ops'
import { type ReactNode, useMemo } from 'react'

type UserProfile = NonNullable<UserProfileQuery['userProfile']>

interface ManageFeatureFlagProviderProps {
  user: UserProfile
  children: ReactNode
}

const config = {
  apiHost: process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST,
  clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY,
}

function ManageFeatureFlagProvider({
  user,
  children,
}: ManageFeatureFlagProviderProps) {
  const attributes = useMemo<FeatureFlagAttributes>(
    () => ({
      id: user.id,
      actorType: 'user',
      role: user.role,
      environment: normalizeFeatureFlagEnvironment(
        process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV
      ),
    }),
    [user.id, user.role]
  )

  return (
    <FeatureFlagProvider config={config} attributes={attributes}>
      {children}
    </FeatureFlagProvider>
  )
}

export default ManageFeatureFlagProvider

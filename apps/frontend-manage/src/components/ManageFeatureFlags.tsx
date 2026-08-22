import { useQuery } from '@apollo/client'
import type { FeatureFlagAttributes } from '@klicker-uzh/feature-flags'
import { FeatureFlagProvider } from '@klicker-uzh/feature-flags/react'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import { type ReactNode, useMemo } from 'react'

// The endpoint and client key are inlined into the browser bundle at image
// build time, so an image built before the repository variables were set
// carries no configuration and every flag evaluates false. `NEXT_PUBLIC_ENV`
// is already supplied by every image workflow, which is why the feature flag
// environment needs no build argument of its own.
const config = {
  apiHost: process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST,
  clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY,
  environment: process.env.NEXT_PUBLIC_ENV,
  forcedOn: process.env.NEXT_PUBLIC_FEATURE_FLAGS_FORCED_ON,
}

const anonymousAttributes: FeatureFlagAttributes = { actorType: 'anonymous' }

/**
 * Publishes the signed-in lecturer to GrowthBook as targeting attributes.
 *
 * Mounted app-wide rather than inside `Layout` because the assistant launcher
 * lives outside `Layout` too. The profile query is the same one `Layout`
 * issues, so Apollo serves it from one request; on `/login` it simply fails
 * and the anonymous attributes leave every flag off.
 */
export function ManageFeatureFlags({ children }: { children: ReactNode }) {
  const { data } = useQuery(UserProfileDocument, {
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-first',
  })
  const profile = data?.userProfile

  const attributes = useMemo<FeatureFlagAttributes>(
    () =>
      profile
        ? {
            actorType: 'user',
            catalyst: Boolean(profile.catalyst),
            id: profile.id,
            role: profile.role,
          }
        : anonymousAttributes,
    [profile]
  )

  return (
    <FeatureFlagProvider attributes={attributes} config={config}>
      {children}
    </FeatureFlagProvider>
  )
}

import { useQuery } from '@apollo/client'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'

/**
 * The client-side half of the gate that `apps/chat` enforces per request: the
 * `ai-beta` flag plus the account's AI entitlement, which records that an
 * administrator has a cost center to bill the resulting model usage to.
 *
 * Both halves are needed here so a lecturer inside the beta cohort but without
 * that entitlement is never shown an entrypoint whose route would refuse them.
 * Hiding is not what protects the surfaces — the server checks the same two
 * conditions — this only keeps the UI honest about what will work.
 *
 * The profile query is the one Manage already issues, so Apollo serves it from
 * cache. On `/login` it fails, which leaves the entitlement undefined and the
 * gate closed.
 */
export function useAiFeaturesEnabled(): boolean {
  const betaEnabled = useFeatureFlag('ai-beta')
  const { data } = useQuery(UserProfileDocument, {
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-first',
  })

  return betaEnabled && data?.userProfile?.aiFeaturesEnabled === true
}

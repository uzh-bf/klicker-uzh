import { useQuery } from '@apollo/client'
import type { FeatureFlagAttributes } from '@klicker-uzh/feature-flags'
import {
  type BrowserFeatureFlagConfig,
  FeatureFlagProvider,
} from '@klicker-uzh/feature-flags/react'
import { SelfDocument, UserRole } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import { type ReactNode, useMemo } from 'react'

interface PwaFeatureFlagProviderProps {
  children: ReactNode
}

const IS_ASSESSMENT = process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true'

// The assessment build is a separate build of this application in which every
// flagged surface is switched off. Leaving out the host and the client key
// makes the browser client start from an empty payload without ever contacting
// GrowthBook, so all flags read as false. The provider itself still has to be
// mounted: the GrowthBook hooks throw when no provider is above them.
const config = {
  apiHost: IS_ASSESSMENT
    ? undefined
    : process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST,
  clientKey: IS_ASSESSMENT
    ? undefined
    : process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY,
  environment: process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV,
} satisfies BrowserFeatureFlagConfig

function PwaFeatureFlagProvider({ children }: PwaFeatureFlagProviderProps) {
  const router = useRouter()

  // Surfaces that never show flagged content must not fetch an identity for it
  // either: the assessment build, pages opened inside a learning management
  // system, and live quiz answering. The readiness check matters because the
  // embed parameter is only known once the router has parsed the query.
  const skipSelf =
    IS_ASSESSMENT ||
    !router.isReady ||
    router.query.embed !== undefined ||
    router.pathname.startsWith('/session')

  const { data } = useQuery(SelfDocument, {
    fetchPolicy: 'cache-and-network',
    skip: skipSelf,
  })

  const self = data?.self
  // Temporary participants stay anonymous on purpose: they are excluded from
  // every flagged surface, so they must not become a targetable identity.
  const participantId =
    self?.role === UserRole.Participant ? self.id : undefined

  const attributes = useMemo<FeatureFlagAttributes>(
    () =>
      participantId
        ? { id: participantId, actorType: 'participant' }
        : { actorType: 'anonymous' },
    [participantId]
  )

  return (
    <FeatureFlagProvider config={config} attributes={attributes}>
      {children}
    </FeatureFlagProvider>
  )
}

export default PwaFeatureFlagProvider

import { useFlags } from '@happykit/flags/client'
import getConfig from 'next/config'
import { useContext } from 'react'

import { AppFlags, FeatureFlags } from '../@types/AppFlags'
import { UserContext } from './userContext'

const { publicRuntimeConfig } = getConfig()

const PERSIST_EMAILS = (publicRuntimeConfig.happyKitPersistedUsers ?? '').split(',')

function FeatureFlagWrapper({ children }) {
  const user = useContext(UserContext)

  const featureFlags = useFlags<AppFlags>({
    revalidateOnFocus: false,
    user: { key: user?.id, persist: PERSIST_EMAILS.includes(user?.email), name: user?.shortname, email: user?.email },
  })

  return children(featureFlags)
}

function withFeatureFlags(Component) {
  const withHOC = (props) => {
    if (publicRuntimeConfig.happyKitFlagEnvKey) {
      return (
        <FeatureFlagWrapper>
          {(featureFlags: FeatureFlags) => <Component featureFlags={featureFlags} {...props} />}
        </FeatureFlagWrapper>
      )
    }
    return <Component {...props} />
  }

  withHOC.displayName = `withFeatureFlags(${Component.displayName})`

  return withHOC
}

export default withFeatureFlags

import { useFlags } from '@happykit/flags/client'
import { useContext } from 'react'

import { AppFlags } from '../@types/AppFlags'
import { UserContext } from './userContext'

const PERSIST_EMAILS = (process.env.NEXT_PUBLIC_HAPPYKIT_PERSISTED_USERS ?? '').split(',')

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
    if (process.env.NEXT_PUBLIC_HAPPYKIT_FLAGS_ENV_KEY) {
      return (
        <FeatureFlagWrapper>
          {(featureFlags) => <Component featureFlags={featureFlags} {...props} />}
        </FeatureFlagWrapper>
      )
    }
    return <Component {...props} />
  }

  withHOC.displayName = `withFeatureFlags(${Component.displayName})`

  return withHOC
}

export default withFeatureFlags

import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

const UNTRACKED_PATHS = ['/user/login']

function HappyKitAnalytics() {
  const { useAnalytics } = import('@happykit/analytics')
  useAnalytics({
    publicKey: publicRuntimeConfig.happyKitAnalyticsKey,
    skip: (pageView) => UNTRACKED_PATHS.includes(pageView.pathname),
  })
  return <></>
}

export default HappyKitAnalytics

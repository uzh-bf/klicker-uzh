const UNTRACKED_PATHS = ['/user/login']

function HappyKitAnalytics() {
  const { useAnalytics } = require('@happykit/analytics')
  useAnalytics({
    publicKey: process.env.NEXT_PUBLIC_HAPPYKIT_ANALYTICS_KEY,
    skip: (pageView) => UNTRACKED_PATHS.includes(pageView.pathname),
  })
  return <></>
}

export default HappyKitAnalytics

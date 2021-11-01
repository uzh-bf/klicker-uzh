const { configure } = require('@happykit/flags/config')

configure({ envKey: process.env.NEXT_PUBLIC_HAPPYKIT_FLAGS_ENV_KEY })

function HappyKitFlags() {
  return null
}

export default HappyKitFlags

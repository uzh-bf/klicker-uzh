import withPWAInit from '@ducanh2912/next-pwa'
import { getNextBaseConfig, getNextPWAConfig } from '@klicker-uzh/next-config'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/types/i18n.ts')

let nextConfig = {
  ...getNextBaseConfig({
    BLOB_STORAGE_ACCOUNT_URL: process.env.BLOB_STORAGE_ACCOUNT_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
  }),
}

if (process.env.NODE_ENV !== 'test') {
  const withPWA = withPWAInit(
    getNextPWAConfig({ NODE_ENV: process.env.NODE_ENV })
  )
  nextConfig = withPWA(nextConfig)
}

nextConfig = withNextIntl(nextConfig)
export default nextConfig

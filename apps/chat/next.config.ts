import { getNextBaseConfig } from '@klicker-uzh/next-config'
import { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/types/i18n.ts')

// App Router app: i18n config is not supported, omit it from base config
const { i18n: _i18n, ...baseConfig } = getNextBaseConfig({
  BLOB_STORAGE_ACCOUNT_URL: process.env.BLOB_STORAGE_ACCOUNT_URL ?? '',
  NODE_ENV: process.env.NODE_ENV as string,
  NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV as string,
})

// @ts-expect-error
const nextConfig: NextConfig = {
  ...baseConfig,
}

export default withNextIntl(nextConfig)

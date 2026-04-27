import { getNextBaseConfig } from '@klicker-uzh/next-config'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/types/i18n.ts')

/** @type {import('next').NextConfig} */
let nextConfig = {
  ...getNextBaseConfig({
    BLOB_STORAGE_ACCOUNT_URL: process.env.BLOB_STORAGE_ACCOUNT_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
  }),
}

nextConfig.transpilePackages = Array.from(
  new Set([
    ...(nextConfig.transpilePackages ?? []),
    '@klicker-uzh/kb-management',
  ])
)

nextConfig = withNextIntl(nextConfig)
export default nextConfig

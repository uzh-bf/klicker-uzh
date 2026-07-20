import { getNextBaseConfig } from '@klicker-uzh/next-config'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/types/i18n.ts')

const nextConfig = getNextBaseConfig({
  BLOB_STORAGE_ACCOUNT_URL: process.env.BLOB_STORAGE_ACCOUNT_URL ?? '',
  includeI18n: false,
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
}) as NextConfig

export default withNextIntl(nextConfig)

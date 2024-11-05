import withPWAInit from '@ducanh2912/next-pwa'
import { getNextBaseConfig, getNextPWAConfig } from '@klicker-uzh/next-config'

/** @type {import('next').NextConfig} */
let nextConfig = {
  ...getNextBaseConfig({
    BLOB_STORAGE_ACCOUNT_URL: process.env.BLOB_STORAGE_ACCOUNT_URL,
  }),
}

if (process.env.NODE_ENV !== 'test') {
  const withPWA = withPWAInit(
    getNextPWAConfig({ NODE_ENV: process.env.NODE_ENV })
  )
  nextConfig = withPWA(nextConfig)
}

export default nextConfig

const {
  getNextBaseConfig,
  getNextPWAConfig,
} = require('@klicker-uzh/next-config')

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...getNextBaseConfig({
    BLOB_STORAGE_ACCOUNT_URL: process.env.BLOB_STORAGE_ACCOUNT_URL,
  }),
}

if (process.env.NODE_ENV !== 'test') {
  const withPWA = require('next-pwa')(
    getNextPWAConfig({ NODE_ENV: process.env.NODE_ENV })
  )
  module.exports = withPWA(nextConfig)
} else {
  module.exports = nextConfig
}

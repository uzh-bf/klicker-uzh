const {
  getNextBaseConfig,
  getNextPWAConfig,
} = require('@klicker-uzh/next-config')

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...getNextBaseConfig({
    S3_HOSTNAME: process.env.S3_HOSTNAME,
    S3_PATHNAME: process.env.S3_PATHNAME,
  }),
  publicRuntimeConfig: {
    API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  serverRuntimeConfig: {
    API_URL_SSR: process.env.NEXT_PUBLIC_API_URL_SSR,
    APP_DOMAIN: process.env.APP_DOMAIN,
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  },
}

if (process.env.NODE_ENV !== 'test') {
  const withPWA = require('next-pwa')(
    getNextPWAConfig({ NODE_ENV: process.env.NODE_ENV })
  )
  module.exports = withPWA(nextConfig)
} else {
  module.exports = nextConfig
}

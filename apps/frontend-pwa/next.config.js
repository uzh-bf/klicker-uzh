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
}

if (process.env.NODE_ENV !== 'test') {
  const withPWA = require('next-pwa')(
    getNextPWAConfig({
      NODE_ENV: process.env.NODE_ENV
    })
  )
  module.exports = withPWA(nextConfig)
} else {
  module.exports = nextConfig
}

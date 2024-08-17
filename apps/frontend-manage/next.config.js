const {
  getNextBaseConfig,
  getNextPWAConfig,
} = require('@klicker-uzh/next-config')

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...getNextBaseConfig({
    BLOB_STORAGE_ACCOUNT_URL: process.env.BLOB_STORAGE_ACCOUNT_URL,
  }),
  async redirects() {
    return [
      {
        source: '/sessions',
        destination: '/quizzes',
        permanent: false,
      },
      {
        source: '/sessions/:id',
        destination: '/quizzes/:id',
        permanent: false,
      },
      {
        source: '/sessions/:id/cockpit',
        destination: '/quizzes/:id/cockpit',
        permanent: false,
      },
      {
        source: '/sessions/:id/evaluation',
        destination: '/quizzes/:id/evaluation',
        permanent: false,
      },
      {
        source: '/sessions/:id/lecturer',
        destination: '/quizzes/:id/lecturer',
        permanent: false,
      },
    ]
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

import withPWAInit from '@ducanh2912/next-pwa'
import { getNextBaseConfig, getNextPWAConfig } from '@klicker-uzh/next-config'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/types/i18n.ts')

/** @type {import('next').NextConfig} */
let nextConfig = {
  ...getNextBaseConfig({
    BLOB_STORAGE_ACCOUNT_URL: process.env.BLOB_STORAGE_ACCOUNT_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
  }),
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/sessions',
        destination: '/quizzes',
        permanent: true,
      },
      {
        source: '/sessions/:id',
        destination: '/quizzes/:id',
        permanent: true,
      },
      {
        source: '/sessions/:id/cockpit',
        destination: '/quizzes/:id/cockpit',
        permanent: true,
      },
      {
        source: '/sessions/:id/evaluation',
        destination: '/quizzes/:id/evaluation',
        permanent: true,
      },
      {
        source: '/sessions/:id/lecturer',
        destination: '/quizzes/:id/lecturer',
        permanent: true,
      },
    ]
  },
}

nextConfig.transpilePackages = Array.from(
  new Set([...(nextConfig.transpilePackages ?? []), 'formik'])
)

if (process.env.NODE_ENV !== 'test') {
  const withPWA = withPWAInit(
    getNextPWAConfig({ NODE_ENV: process.env.NODE_ENV })
  )
  nextConfig = withPWA(nextConfig)
}

nextConfig = withNextIntl(nextConfig)
export default nextConfig

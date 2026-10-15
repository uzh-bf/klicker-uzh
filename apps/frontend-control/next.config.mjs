import withPWAInit from '@ducanh2912/next-pwa'
import { getNextBaseConfig, getNextPWAConfig } from '@klicker-uzh/next-config'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/types/i18n.ts')

/** @type {import('next').NextConfig} */
let nextConfig = {
  ...getNextBaseConfig({
    BLOB_STORAGE_ACCOUNT_URL: process.env.BLOB_STORAGE_ACCOUNT_URL,
    NODE_ENV: process.env.NODE_ENV,
    pagesRouterOnly: true,
    buildTsconfigPath: 'tsconfig.check.json',
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
  }),
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
  // Opt-in same-origin GraphQL proxy (local dev): WebKit treats each
  // *.klicker.localhost host as its own site and withholds the SameSite=Lax
  // session cookie on cross-host API calls, which breaks iOS (Capacitor) login.
  async rewrites() {
    const { NEXT_PUBLIC_CONTROL_API_URL, CONTROL_API_PROXY_URL } = process.env
    if (!NEXT_PUBLIC_CONTROL_API_URL || !CONTROL_API_PROXY_URL) {
      return []
    }
    return [
      {
        source: new URL(NEXT_PUBLIC_CONTROL_API_URL).pathname,
        destination: CONTROL_API_PROXY_URL,
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

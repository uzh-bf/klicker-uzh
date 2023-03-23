/** @type {import('next').NextConfig} */

const withPWA = require('next-pwa')({
  dest: 'public',
  skipWaiting: true,
  dynamicStartUrlRedirect: true,
  disable:
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
})

const nextConfig = withPWA({
  transpilePackages: ['shared-components'],
  i18n: {
    locales: ['en', 'de'],
    defaultLocale: 'de',
  },
  modularizeImports: {
    ramda: {
      transform: 'ramda/es/{{member}}',
    },
    lodash: {
      transform: 'lodash/{{member}}',
    },
  },
  // TODO: disable compression if it is done on the ingress
  compress: true,
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: [
      process.env.S3_HOSTNAME,
      '127.0.0.1',
      'upload.wikimedia.org',
      'tc-klicker-prod.s3.amazonaws.com',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tc-klicker-prod.s3.amazonaws.com',
        port: '443',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: process.env.S3_HOSTNAME,
        port: '443',
        pathname: process.env.S3_PATHNAME,
      },
    ],
  },
  publicRuntimeConfig: {
    API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  serverRuntimeConfig: {
    API_URL_SSR: process.env.NEXT_PUBLIC_API_URL_SSR,
    APP_SECRET: process.env.APP_SECRET,
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  },
})

module.exports = nextConfig

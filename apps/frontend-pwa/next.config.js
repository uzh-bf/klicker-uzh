/** @type {import('next').NextConfig} */

const withPWA = require('next-pwa')({
  dest: 'public',
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig = withPWA({
  reactStrictMode: true,
  swcMinify: true,
  publicRuntimeConfig: {
    API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:7071/api/graphql',
    ADDRESPONSE_URL:
      process.env.NEXT_PUBLIC_ADDRESPONSE_URL ??
      'http://127.0.0.1:7072/api/AddResponse',
  },
  serverRuntimeConfig: {
    APP_DOMAIN: process.env.APP_DOMAIN ?? '127.0.0.1',
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? process.env.APP_DOMAIN,
  },
})

module.exports = nextConfig

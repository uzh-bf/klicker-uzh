/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  i18n: {
    locales: ['de', 'en'],
    defaultLocale: 'en',
  },
  publicRuntimeConfig: {
    API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:7071/api/graphql',
  },
  serverRuntimeConfig: {
    APP_DOMAIN: process.env.APP_DOMAIN ?? '127.0.0.1',
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? process.env.APP_DOMAIN,
  },
}

module.exports = nextConfig

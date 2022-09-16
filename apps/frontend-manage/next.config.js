/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  i18n: {
    locales: ['de', 'en'],
    defaultLocale: 'en',
  },
  publicRuntimeConfig: {
    API_URL:
      process.env.NEXT_PUBLIC_API_URL,
  },
  serverRuntimeConfig: {
    APP_DOMAIN: process.env.APP_DOMAIN,
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  },
}

module.exports = nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['sos-ch-dk-2.exo.io'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sos-ch-dk-2.exo.io',
        port: '443',
        pathname: '/klicker-uzh-dev/**',
      },
    ],
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'sos-ch-dk-2.exo.io',
          port: '443',
          pathname: '/klicker-uzh-dev/**',
        },
      ],
    },
  },
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['https://sos-ch-dk-2.exo.io'],
  },
  publicRuntimeConfig: {
    API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7071/api/graphql',
  },
  serverRuntimeConfig: {
    APP_DOMAIN: process.env.APP_DOMAIN ?? 'localhost',
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? process.env.APP_DOMAIN,
  },
}

module.exports = nextConfig

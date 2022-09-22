/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    modularizeImports: {
      ramda: {
        transform: 'ramda/es/{{member}}',
      },
      lodash: {
        transform: 'lodash/{{member}}',
      },
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
  i18n: {
    locales: ['de', 'en'],
    defaultLocale: 'en',
  },
  images: {
    domains: [process.env.S3_HOSTNAME],
    remotePatterns: [
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
    APP_DOMAIN: process.env.APP_DOMAIN,
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  },
}

module.exports = nextConfig

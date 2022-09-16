/** @type {import('next').NextConfig} */

const withPWA = require('next-pwa')({
  dest: 'public',
  skipWaiting: true,
  // disable: process.env.NODE_ENV === 'development',
})

const nextConfig = withPWA({
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
    domains: ['127.0.0.1', process.env.S3_HOSTNAME],
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
    ADD_RESPONSE_URL: process.env.NEXT_PUBLIC_ADD_RESPONSE_URL,
  },
  serverRuntimeConfig: {
    APP_DOMAIN: process.env.APP_DOMAIN,
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  },
})

module.exports = nextConfig

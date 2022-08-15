/** @type {import('next').NextConfig} */

const withPWA = require("next-pwa")

const nextConfig = withPWA({
  reactStrictMode: true,
  swcMinify: true,
  pwa: {
    dest: "public",
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
  },
  publicRuntimeConfig: { apiURL: "http://localhost:7071/api/graphql" }
})

module.exports = nextConfig

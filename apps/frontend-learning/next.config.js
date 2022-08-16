/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  publicRuntimeConfig: {
    apiURL:
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7071/api/graphql',
  },
}

module.exports = nextConfig

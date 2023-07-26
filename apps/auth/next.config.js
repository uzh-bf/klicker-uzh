/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ['en', 'de'],
    defaultLocale: 'de',
  },
  transpilePackages: ['shared-components'],
  compress: true,
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  i18n: {
    locales: ['de', 'en'],
    defaultLocale: 'en',
  },
}

module.exports = nextConfig

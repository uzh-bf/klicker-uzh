const { getNextBaseConfig } = require('@klicker-uzh/next-config')
const { PrismaPlugin } = require('@prisma/nextjs-monorepo-workaround-plugin')

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...getNextBaseConfig({
    S3_HOSTNAME: process.env.S3_HOSTNAME,
    S3_PATHNAME: process.env.S3_PATHNAME,
  }),
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()]
    }
    return config
  },
}

module.exports = nextConfig

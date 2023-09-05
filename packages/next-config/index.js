/** @type {import('next').NextConfig} */

function getNextBaseConfig({ S3_HOSTNAME, S3_PATHNAME, NODE_ENV }) {
  return {
    compress: true,
    output: 'standalone',
    reactStrictMode: true,
    swcMinify: true,
    transpilePackages: ['@klicker-uzh/shared-components', '@klicker-uzh/i18n'],
    eslint: {
      ignoreDuringBuilds: true,
    },
    typescript: {
      ignoreBuildErrors: true,
    },
    i18n: {
      locales: ['en', 'de'],
      defaultLocale: 'en',
    },
    modularizeImports: {
      ramda: {
        transform: 'ramda/es/{{member}}',
      },
      lodash: {
        transform: 'lodash/{{member}}',
      },
    },
    images: {
      domains: [
        '127.0.0.1',
        'tc-klicker-prod.s3.amazonaws.com',
        'klickeruzhdevimages.blob.core.windows.net',
        'klickeruzhprodimages.blob.core.windows.net',
        S3_HOSTNAME,
      ],
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'tc-klicker-prod.s3.amazonaws.com',
          port: '443',
          pathname: '/images/**',
        },
        {
          protocol: 'https',
          hostname: 'klickeruzhdevimages.blob.core.windows.net',
          port: '443',
          pathname: '/**',
        },
        {
          protocol: 'https',
          hostname: 'klickeruzhprodimages.blob.core.windows.net',
          port: '443',
          pathname: '/**',
        },
        {
          protocol: 'https',
          hostname: S3_HOSTNAME,
          port: '443',
          pathname: S3_PATHNAME,
        },
      ],
    },
  }
}

function getNextPWAConfig({ NODE_ENV }) {
  return {
    dest: 'public',
    skipWaiting: true,
    dynamicStartUrlRedirect: true,
    // disable: NODE_ENV === 'development',
  }
}

module.exports = {
  getNextBaseConfig,
  getNextPWAConfig,
}

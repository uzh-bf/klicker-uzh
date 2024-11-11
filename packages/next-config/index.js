/** @type {import('next').NextConfig} */
function getNextBaseConfig({ BLOB_STORAGE_ACCOUNT_URL, NODE_ENV }) {
  return {
    // not supported with turbopack -> do we need it?
    // experimental: {
    //   esmExternals: 'loose',
    // },
    compress: true,
    output: NODE_ENV !== 'test' ? 'standalone' : undefined,
    reactStrictMode: true,
    transpilePackages: [
      '@klicker-uzh/shared-components',
      '@klicker-uzh/i18n',
      '@klicker-uzh/util',
    ],
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
        BLOB_STORAGE_ACCOUNT_URL ?? null,
      ].filter(Boolean),
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
        BLOB_STORAGE_ACCOUNT_URL
          ? {
              protocol: 'https',
              hostname: BLOB_STORAGE_ACCOUNT_URL,
              port: '443',
              pathname: '/**',
            }
          : null,
      ].filter(Boolean),
    },
  }
}

function getNextPWAConfig({ NODE_ENV }) {
  return {
    dest: 'public',
    skipWaiting: true,
    dynamicStartUrlRedirect: true,
    disable: NODE_ENV === 'development',
  }
}

module.exports = {
  getNextBaseConfig,
  getNextPWAConfig,
}

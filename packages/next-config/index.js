/** @type {import('next').NextConfig} */
function getNextBaseConfig({
  BLOB_STORAGE_ACCOUNT_URL,
  NODE_ENV,
  NEXT_PUBLIC_ENV,
}) {
  const isStaging = process.env.NEXT_PUBLIC_ENV === 'staging'

  return {
    productionBrowserSourceMaps: isStaging,
    webpack: (config, { isServer }) => {
      // Needed for webpack server builds to resolve conditional exports correctly
      // (e.g. embla-carousel-react from @uzh-bf/design-system). Without this,
      // the server bundle resolves the browser variant and fails with
      // "useEmblaCarousel is not defined" during page data collection.
      if (isServer) {
        config.resolve.conditionNames = ['node', 'development', '...']
      } else {
        config.resolve.conditionNames = ['development', '...']
      }
      return config
    },
    compress: true,
    output: NODE_ENV !== 'test' ? 'standalone' : undefined,
    reactStrictMode: true,
    transpilePackages: [
      '@klicker-uzh/shared-components',
      '@klicker-uzh/i18n',
      '@klicker-uzh/util',
      '@klicker-uzh/prisma',
      '@uzh-bf/design-system',
    ],
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

export { getNextBaseConfig, getNextPWAConfig }

import { fileURLToPath } from 'node:url'

const monorepoRoot = fileURLToPath(new URL('../..', import.meta.url))

/** @type {import('next').NextConfig} */
function getNextBaseConfig({
  BLOB_STORAGE_ACCOUNT_URL,
  includeI18n = true,
  NODE_ENV,
  NEXT_PUBLIC_ENV,
}) {
  const isStaging = NEXT_PUBLIC_ENV === 'staging'
  const allowLocalImageOptimization =
    NODE_ENV === 'development' || NODE_ENV === 'test'
  const blobStorageHostname = getHostname(BLOB_STORAGE_ACCOUNT_URL)

  return {
    // Allow any *.localhost dev host (primary `<app>.klicker.localhost` and
    // worktree `<app>.klicker.<workspace>.localhost`) to reach Next dev
    // resources (HMR, fonts). Next 16 blocks cross-origin dev requests by
    // default and its implicit `*.localhost` only matches a single segment,
    // so multi-label localhost hosts (worktrees) would otherwise be blocked
    // and never finish hydrating. Dev-only; not applied in production.
    allowedDevOrigins:
      NODE_ENV === 'development' ? ['**.localhost'] : undefined,
    outputFileTracingRoot: monorepoRoot,
    productionBrowserSourceMaps: isStaging,
    turbopack: {
      root: monorepoRoot,
    },
    webpack: (config, { isServer }) => {
      if (!isServer && isStaging) {
        config.devtool = 'cheap-module-source-map'
      }
      // Configure webpack to resolve conditional exports correctly
      if (isServer) {
        // For server builds: prioritize 'node' condition for packages like file-type
        // that have Node.js-specific exports (e.g., PayloadCMS's file-type dependency)
        config.resolve.conditionNames = ['node', 'development', '...']
      } else {
        // For client builds: use standard conditions plus 'development' for local packages
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
    ...(includeI18n
      ? {
          i18n: {
            locales: ['en', 'de'],
            defaultLocale: 'en',
          },
        }
      : {}),
    modularizeImports: {
      lodash: {
        transform: 'lodash/{{member}}',
      },
    },
    images: {
      qualities: [75],
      dangerouslyAllowLocalIP: allowLocalImageOptimization,
      remotePatterns: [
        allowLocalImageOptimization
          ? {
              protocol: 'http',
              hostname: '127.0.0.1',
              pathname: '/**',
            }
          : null,
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
        blobStorageHostname
          ? {
              protocol: 'https',
              hostname: blobStorageHostname,
              port: '443',
              pathname: '/**',
            }
          : null,
      ].filter(Boolean),
    },
  }
}

function getHostname(value) {
  if (!value) return null

  try {
    return new URL(value).hostname
  } catch {
    return value
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

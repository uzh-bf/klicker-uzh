import { fileURLToPath } from 'node:url'

const monorepoRoot = fileURLToPath(new URL('../..', import.meta.url))

/** @type {import('next').NextConfig} */
function getNextBaseConfig({
  BLOB_STORAGE_ACCOUNT_URL,
  MEDIA_STORAGE_PUBLIC_URL = process.env.MEDIA_STORAGE_PUBLIC_URL,
  MEDIA_STORAGE_PROVIDER = process.env.MEDIA_STORAGE_PROVIDER,
  includeI18n = true,
  pagesRouterOnly = false,
  buildTsconfigPath = '',
  NODE_ENV,
  NEXT_PUBLIC_ENV,
}) {
  if (MEDIA_STORAGE_PROVIDER === 's3' && !MEDIA_STORAGE_PUBLIC_URL?.trim()) {
    throw new Error(
      'MEDIA_STORAGE_PUBLIC_URL is required when building S3 media frontends'
    )
  }
  const isStaging = NEXT_PUBLIC_ENV === 'staging'
  const allowLocalImageOptimization =
    NODE_ENV === 'development' ||
    NODE_ENV === 'test' ||
    process.env.KLICKER_PLAYWRIGHT_FIXTURES === '1'
  const blobStorageHostname = getHostname(BLOB_STORAGE_ACCOUNT_URL)

  return {
    // Reuse the strict check config to exclude stale dev-route validators
    // from production compilation without changing the development editor.
    ...(buildTsconfigPath && NODE_ENV !== 'development'
      ? { typescript: { tsconfigPath: buildTsconfigPath } }
      : {}),
    // Pages-only apps need no cross-router filter. Its initial Turbopack
    // update can let an older development route scan overwrite a newer one.
    // Remove the opt-in when an app starts using App Router routes.
    ...(pagesRouterOnly && NODE_ENV === 'development'
      ? { experimental: { clientRouterFilter: false } }
      : {}),
    // Allow any *.localhost dev host (primary `<app>.klicker.localhost` and
    // worktree `<app>.klicker.<workspace>.localhost`) to reach Next dev
    // resources (HMR, fonts). Next 16 blocks cross-origin dev requests by
    // default and its implicit `*.localhost` only matches a single segment,
    // so multi-label localhost hosts (worktrees) would otherwise be blocked
    // and never finish hydrating. Dev-only; not applied in production.
    allowedDevOrigins:
      NODE_ENV === 'development' ? ['**.localhost'] : undefined,
    // The dev-mode indicator portal overlays the page and can intercept
    // browser-test clicks (its bounds cover the viewport even when the
    // indicator itself is idle), so disable it where the Playwright suite
    // runs. Error overlays are unaffected.
    devIndicators: NODE_ENV === 'development' ? false : undefined,
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
        getMediaStorageRemotePattern(
          MEDIA_STORAGE_PUBLIC_URL,
          allowLocalImageOptimization
        ),
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

// A build-time public URL allow-list, never a storage API endpoint or secret.
function getMediaStorageRemotePattern(value, allowLocal) {
  if (!value?.trim()) return null
  let url
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('MEDIA_STORAGE_PUBLIC_URL is invalid')
  }
  let decodedPath
  try {
    decodedPath = decodeURIComponent(url.pathname)
  } catch {
    throw new Error('MEDIA_STORAGE_PUBLIC_URL is invalid')
  }
  const hasGlob = (value) =>
    ['*', '?', '[', ']', '{', '}', '(', ')', '!', '+', '@'].some((character) =>
      value.includes(character)
    )
  const literalIpv6 = url.hostname.startsWith('[') && url.hostname.endsWith(']')
  const local =
    url.hostname === 'localhost' ||
    url.hostname.endsWith('.localhost') ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]'
  if (
    (url.protocol !== 'https:' &&
      !(allowLocal && local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (!literalIpv6 && hasGlob(url.hostname)) ||
    hasGlob(decodedPath)
  ) {
    throw new Error(
      'MEDIA_STORAGE_PUBLIC_URL must be an HTTPS public media base URL'
    )
  }
  let path = url.pathname
  while (path.endsWith('/')) path = path.slice(0, -1)
  return {
    protocol: url.protocol.slice(0, -1),
    hostname: literalIpv6
      ? url.hostname.replaceAll('[', '\\[').replaceAll(']', '\\]')
      : url.hostname,
    port: url.port,
    pathname: `${path}/**`,
    search: '',
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

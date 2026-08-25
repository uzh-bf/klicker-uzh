import { getNextBaseConfig } from '@klicker-uzh/next-config'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { fileURLToPath } from 'node:url'

const withNextIntl = createNextIntlPlugin('./src/types/i18n.ts')
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))
const baseConfig = getNextBaseConfig({
  BLOB_STORAGE_ACCOUNT_URL: process.env.BLOB_STORAGE_ACCOUNT_URL ?? '',
  includeI18n: false,
  NODE_ENV: process.env.NODE_ENV as string,
  NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV as string,
})

// @ts-expect-error Next's config type does not expose all bundler options used here.
const nextConfig: NextConfig = {
  ...baseConfig,
  outputFileTracingRoot: repositoryRoot,
  turbopack: {
    root: repositoryRoot,
  },
  serverExternalPackages: [
    '@klicker-uzh/knowledge-graph',
    '@js-temporal/polyfill',
    'falkordb',
    'jsbi',
  ],
  webpack: (config, { isServer }) => {
    if (baseConfig.webpack) {
      config = baseConfig.webpack(config, { isServer } as any)
    }

    return config
  },
}

export default withNextIntl(nextConfig)

import { getNextBaseConfig } from '@klicker-uzh/next-config'
import { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/types/i18n.ts')

// @ts-expect-error
const nextConfig: NextConfig = {
  ...getNextBaseConfig({
    BLOB_STORAGE_ACCOUNT_URL: process.env.BLOB_STORAGE_ACCOUNT_URL ?? '',
    NODE_ENV: process.env.NODE_ENV as string,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV as string,
  }),
  webpack: (config, { isServer }) => {
    // Call the base config webpack function if it exists
    const baseConfig = getNextBaseConfig({
      BLOB_STORAGE_ACCOUNT_URL: process.env.BLOB_STORAGE_ACCOUNT_URL ?? '',
      NODE_ENV: process.env.NODE_ENV as string,
      NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV as string,
    })
    if (baseConfig.webpack) {
      config = baseConfig.webpack(config, { isServer } as any)
    }

    return config
  },
}

export default withNextIntl(nextConfig)

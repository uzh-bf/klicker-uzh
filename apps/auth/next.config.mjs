import { getNextBaseConfig } from '@klicker-uzh/next-config'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/types/i18n.ts')

/** @type {import('next').NextConfig} */
const nextConfig = getNextBaseConfig({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
})

export default withNextIntl(nextConfig)

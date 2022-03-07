// This file configures the initialization of Sentry on the browser.
// The config you add here will be used whenever a page is visited.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

Sentry.init({
  debug: publicRuntimeConfig.sentryDebug,
  dsn: publicRuntimeConfig.sentryDSN,
  release: publicRuntimeConfig.sentryRelease,
  environment: publicRuntimeConfig.sentryEnv,
  tracesSampleRate: publicRuntimeConfig.sentrySampleRate,
})

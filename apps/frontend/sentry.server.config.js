// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

import getConfig from 'next/config'

const { publicRuntimeConfig, serverRuntimeConfig } = getConfig()

Sentry.init({
  debug: publicRuntimeConfig.sentryDebug,
  dsn: publicRuntimeConfig.sentryDSN,
  release: publicRuntimeConfig.sentryRelease,
  environment: publicRuntimeConfig.sentryEnv,
  tracesSampleRate: publicRuntimeConfig.sentrySampleRate,
})

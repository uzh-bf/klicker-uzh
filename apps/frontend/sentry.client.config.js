// This file configures the initialization of Sentry on the browser.
// The config you add here will be used whenever a page is visited.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

import CFG from './src/klicker.conf.js'

const SERVICES_CFG = CFG.get('services')

if (SERVICES_CFG.sentry.enabled) {
  Sentry.init({
    dsn: SERVICES_CFG.sentry.dsn,
    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: SERVICES_CFG.sentry.tracesSampleRate,
    environment: SERVICES_CFG.sentry.environment,
    // ...
    // Note: if you want to override the automatic release value, do not set a
    // `release` value here - use the environment variable `SENTRY_RELEASE`, so
    // that it will also get attached to your source maps
  })
}

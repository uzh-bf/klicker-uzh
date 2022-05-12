/* eslint-disable import/no-extraneous-dependencies, no-param-reassign */

import { withSentryConfig } from '@sentry/nextjs'
import { PHASE_PRODUCTION_SERVER, PHASE_DEVELOPMENT_SERVER } from 'next/constants.js'
import CFG from './src/klicker.conf.mjs'

const API_CFG = CFG.get('api')
const APP_CFG = CFG.get('app')
const S3_CFG = CFG.get('s3')
const SECURITY_CFG = CFG.get('security')
const SERVICES_CFG = CFG.get('services')
const AZURE_CFG = CFG.get('azure')

const CONFIG = (phase) => {
  let config = {
    // experimental: {
    // outputStandalone: true,
    // },
    images: [PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER].includes(phase)
      ? {
          domains: [S3_CFG.rootDomain],
        }
      : undefined,
    productionBrowserSourceMaps: true,
    // env: {
    //   __DEV__: PHASE_DEVELOPMENT_SERVER,
    // },
    eslint: {
      ignoreDuringBuilds: true,
    },
    sentry: {
      disableServerWebpackPlugin: true,
      disableClientWebpackPlugin: true,
    },
    // custom runtime configuration
    publicRuntimeConfig: {
      apiUrl: API_CFG.endpoint,
      apiUrlWS: API_CFG.endpointWS,
      baseUrl: APP_CFG.baseUrl,
      chatwootBaseUrl: SERVICES_CFG.chatwoot.baseUrl,
      chatwootToken: SERVICES_CFG.chatwoot.websiteToken,
      googleAnalyticsTrackingId: SERVICES_CFG.googleAnalytics.trackingId,
      matomoSiteUrl: SERVICES_CFG.matomo.siteUrl,
      matomoSiteId: SERVICES_CFG.matomo.siteId,
      happyKitAnalyticsKey: SERVICES_CFG.happyKit.publicKey,
      happyKitFlagEnvKey: SERVICES_CFG.happyKit.envKey,
      happyKitPersistedUsers: SERVICES_CFG.happyKit.persistedUsers,
      persistQueries: APP_CFG.persistQueries,
      s3root: S3_CFG.rootUrl,
      sentryDSN: SERVICES_CFG.sentry.dsn,
      sentryRelease: SERVICES_CFG.sentry.release,
      sentryDebug: SERVICES_CFG.sentry.debug,
      sentrySampleRate: SERVICES_CFG.sentry.sampleRate,
      sentryEnv: SERVICES_CFG.sentry.env,
      withFingerprinting: SECURITY_CFG.fingerprinting,
      withAai: APP_CFG.withAai,
      supportEmail: APP_CFG.supportEmail,
      addResponseEndpoint: AZURE_CFG.addResponseEndpoint,
    },
    serverRuntimeConfig: {
      apiUrlSSR: API_CFG.endpointSSR,
      joinUrl: APP_CFG.joinUrl,
      baseUrl: APP_CFG.baseUrl,
    },
    // setup custom webpack configuration
    webpack: (webpackConfig, { dev }) => {
      // ignore test files when bundling
      // webpackConfig.plugins.push(new webpack.IgnorePlugin(/src\/pages.*\/test.*/))

      // push graphql loaders into the webpack config
      webpackConfig.module.rules.push({
        test: /\.graphql$/,
        use: [
          /* {
            loader: 'graphql-persisted-document-loader',
            options: {
              addTypename: true,
            },
          }, */
          { loader: 'graphql-tag/loader' },
        ],
      })

      if (!dev) {
        // https://formatjs.io/docs/guides/advanced-usage#react-intl-without-parser-40-smaller
        webpackConfig.resolve.alias['@formatjs/icu-messageformat-parser'] =
          '@formatjs/icu-messageformat-parser/no-parser'
      }

      return webpackConfig
    },
  }

  // if (process.env.ANALYZE && phase === PHASE_PRODUCTION_BUILD) {
  //   const withBundleAnalyzer = require('@next/bundle-analyzer')({
  //     enabled: process.env.ANALYZE,
  //   })
  //   config = withBundleAnalyzer(config)
  // }

  config = withSentryConfig(config)

  return config
}

export default CONFIG

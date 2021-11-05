/* eslint-disable import/no-extraneous-dependencies, no-param-reassign */

const { withSentryConfig } = require('@sentry/nextjs')
const { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER, PHASE_DEVELOPMENT_SERVER } = require('next/constants')
const CFG = require('./src/klicker.conf.js')

const API_CFG = CFG.get('api')
const APP_CFG = CFG.get('app')
const S3_CFG = CFG.get('s3')
const SECURITY_CFG = CFG.get('security')
const SERVICES_CFG = CFG.get('services')

module.exports = (phase) => {
  let config = {
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
    // custom runtime configuration
    publicRuntimeConfig: {
      apiUrl: API_CFG.endpoint,
      apiUrlWS: API_CFG.endpointWS,
      baseUrl: APP_CFG.baseUrl,
      googleAnalyticsTrackingId: SERVICES_CFG.googleAnalytics.trackingId,
      matomoSiteUrl: SERVICES_CFG.matomo.siteUrl,
      matomoSiteId: SERVICES_CFG.matomo.siteId,
      happyKitAnalyticsKey: SERVICES_CFG.happyKit.publicKey,
      happyKitFlagEnvKey: SERVICES_CFG.happyKit.envKey,
      happyKitPersistedUsers: SERVICES_CFG.happyKit.persistedUsers,
      persistQueries: APP_CFG.persistQueries,
      s3root: S3_CFG.rootUrl,
      sentryDSN: SERVICES_CFG.sentry.dsn,
      withFingerprinting: SECURITY_CFG.fingerprinting,
      withAai: APP_CFG.withAai,
    },
    serverRuntimeConfig: {
      apiUrlSSR: API_CFG.endpointSSR,
      rootDir: __dirname,
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

  if (phase === PHASE_PRODUCTION_BUILD) {
    const withBundleAnalyzer = require('@next/bundle-analyzer')({
      enabled: process.env.ANALYZE === 'true',
    })
    config = withBundleAnalyzer(config)
  }

  if (SERVICES_CFG.sentry.enabled) {
    config = withSentryConfig(config, {
      // silent: true,
    })
  }

  return config
}

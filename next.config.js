/* eslint-disable import/no-extraneous-dependencies, no-param-reassign */

const webpack = require('webpack')
const withCSS = require('@zeit/next-css')
const withSourceMaps = require('@zeit/next-source-maps')()
const { DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } = require('next/constants')
const SentryWebpackPlugin = require('@sentry/webpack-plugin')

const CFG = require('./src/klicker.conf.js')

const API_CFG = CFG.get('api')
const APP_CFG = CFG.get('app')
const S3_CFG = CFG.get('s3')
const SECURITY_CFG = CFG.get('security')
const SERVICES_CFG = CFG.get('services')

const basePath = ''

module.exports = (phase) => {
  let config = {
    // custom runtime configuration
    publicRuntimeConfig: {
      analyticsTrackingID: SERVICES_CFG.googleAnalytics.trackingId,
      apiUrl: API_CFG.endpoint,
      apiUrlWS: API_CFG.endpointWS,
      baseUrl: APP_CFG.baseUrl,
      joinUrl: APP_CFG.joinUrl,
      logrocketAppID: SERVICES_CFG.logrocket.appId,
      persistQueries: APP_CFG.persistQueries,
      s3root: S3_CFG.rootUrl,
      sentryDSN: SERVICES_CFG.sentry.dsn,
      slaaskWidgetKey: SERVICES_CFG.slaask.widgetKey,
      withFingerprinting: SECURITY_CFG.fingerprinting,
    },
    serverRuntimeConfig: {
      apiUrlSSR: API_CFG.endpointSSR,
      rootDir: __dirname,
    },
    // setup custom webpack configuration
    webpack: (webpackConfig, { isServer }) => {
      // replace the sentry library when rendering on the client
      // ref: https://github.com/vercel/next.js/blob/canary/examples/with-sentry/next.config.js
      if (!isServer) {
        webpackConfig.resolve.alias['@sentry/node'] = '@sentry/browser'
      }

      // ignore test files when bundling
      webpackConfig.plugins.push(new webpack.IgnorePlugin(/src\/pages.*\/test.*/))

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

      // push url-loader to enable loading fonts
      webpackConfig.module.rules.push({
        test: /\.(jpe?g|png|svg|gif|eot|ttf|woff|woff2)$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              fallback: 'file-loader',
              esModule: false,
              limit: 100000,
              name: '[name]-[hash].[ext]',
              outputPath: `${isServer ? '../' : ''}static/images/`,
              publicPath: '/_next/static/images/',
            },
          },
        ],
      })

      webpackConfig.module.rules.push({
        test: /\.mjs$/,
        type: 'javascript/auto',
      })

      if (
        SERVICES_CFG.sentry.dsn &&
        SERVICES_CFG.sentry.org &&
        SERVICES_CFG.sentry.project &&
        SERVICES_CFG.sentry.authToken &&
        process.env.NODE_ENV === 'production'
      )
        webpackConfig.plugins.push(
          new SentryWebpackPlugin({
            include: '.next',
            ignore: ['node_modules'],
            stripPrefix: ['webpack://_N_E/'],
            urlPrefix: `~${basePath}/_next`,
            release: process.env.npm_package_version,
          })
        )

      webpackConfig.resolve.extensions = ['.ts', '.tsx', '.mjs', '.js']

      return webpackConfig
    },
  }

  // development only configuration
  if (phase === DEVELOPMENT_SERVER) {
    // activate polling to make watching work inside Docker on Windows
    config.webpackDevMiddleware = (middlewareConfig) => ({
      ...middlewareConfig,
      watchOptions: {
        poll: 1000,
      },
    })
  }

  // enable next-css plugin
  // allows importing css files
  config = withCSS(config)

  // enable sourcemaps
  config = withSourceMaps(config)

  // build only configuration
  if (phase === PHASE_PRODUCTION_BUILD) {
    // setup the bundle analyzer plugin
    const withBundleAnalyzer = require('@zeit/next-bundle-analyzer')
    config = withBundleAnalyzer({
      analyzeBrowser: ['browser', 'both'].includes(process.env.BUNDLE_ANALYZE),
      analyzeServer: ['server', 'both'].includes(process.env.BUNDLE_ANALYZE),
      bundleAnalyzerConfig: {
        browser: {
          analyzerMode: 'static',
          reportFilename: 'bundles/client.html',
        },
        server: {
          analyzerMode: 'static',
          reportFilename: '../bundles/server.html',
        },
      },
      ...config,
    })
  }

  return config
}

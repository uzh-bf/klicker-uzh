/* eslint-disable import/no-extraneous-dependencies */

const webpack = require('webpack')
const withCSS = require('@zeit/next-css')
const withSourceMaps = require('@zeit/next-source-maps')
const { DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } = require('next/constants')

module.exports = phase => {
  let config = {
    // custom runtime configuration
    publicRuntimeConfig: {},
    serverRuntimeConfig: {},
    // setup custom webpack configuration
    webpack: (webpackConfig, { isServer }) => {
      // ignore test files when bundling
      webpackConfig.plugins.push(new webpack.IgnorePlugin(/src\/pages.*\/test.*/))

      // push graphql loaders into the webpack config
      webpackConfig.module.rules.push({
        test: /\.graphql$/,
        use: [
          {
            loader: 'graphql-persisted-document-loader',
            options: {
              addTypename: true,
            },
          },
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
              limit: 100000,
              name: '[name]-[hash].[ext]',
              outputPath: `${isServer ? '../' : ''}static/images/`,
              publicPath: '/_next/static/images/',
            },
          },
        ],
      })

      return webpackConfig
    },
  }

  // development only configuration
  if (phase === DEVELOPMENT_SERVER) {
    // activate polling to make watching work inside Docker on Windows
    config.webpackDevMiddleware = middlewareConfig => ({
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
          reportFilename: '../bundles/client.html',
        },
        server: {
          analyzerMode: 'static',
          reportFilename: '../../bundles/server.html',
        },
      },
      ...config,
    })
  }

  return config
}

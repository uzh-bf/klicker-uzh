/* eslint-disable import/no-extraneous-dependencies */

const webpack = require('webpack')
const withCSS = require('@zeit/next-css')
const { DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } = require('next/constants')

module.exports = (phase) => {
  let config = {
    // custom runtime configuration
    publicRuntimeConfig: {},
    serverRuntimeConfig: {},
    // setup custom webpack configuration
    webpack: (webpackConfig, { isServer }) => {
      // add the webpack context replacement plugin to remove moment locales
      webpackConfig.plugins.push(new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /en/))

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
              limit: 8192,
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

  // enable next-css plugin
  // allows importing css files
  config = withCSS(config)

  // development only configuration
  if (phase === DEVELOPMENT_SERVER) {
    config = {
      ...config,
    }
  }

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

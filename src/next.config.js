/* eslint-disable import/no-extraneous-dependencies */

const webpack = require('webpack')
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants')

module.exports = (phase) => {
  const baseConfig = {
    publicRuntimeConfig: {},
    serverRuntimeConfig: {},
    webpack: (config) => {
      // add the webpack context replacement plugin to remove moment locales
      config.plugins.push(new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /en/))

      // ignore test files when bundling
      config.plugins.push(new webpack.IgnorePlugin(/src\/pages.*\/test.*/))

      // push graphql loaders into the webpack config
      config.module.rules.push({
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

      return config
    },
  }

  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const withBundleAnalyzer = require('@zeit/next-bundle-analyzer')
    // const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')

    withBundleAnalyzer({
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
    })
  }

  return baseConfig
}

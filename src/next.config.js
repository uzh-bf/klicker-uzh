/* eslint-disable import/no-extraneous-dependencies */

const webpack = require('webpack')

const { ANALYZE } = process.env

module.exports = {
  webpack: (config, { isServer }) => {
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

    // add the bundle analyzer plugin if enabled
    if (ANALYZE) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')

      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          analyzerPort: isServer ? 8888 : 8889,
          openAnalyzer: true,
        }),
      )
    }

    return config
  },
}

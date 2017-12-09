/* eslint-disable import/no-extraneous-dependencies */

const webpack = require('webpack')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')

const { ANALYZE } = process.env

module.exports = {
  webpack: (config) => {
    config.plugins.push(new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /de-ch|en-us/))

    if (ANALYZE) {
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          analyzerPort: 8888,
          openAnalyzer: true,
        }),
      )
    }

    return config
  },
}

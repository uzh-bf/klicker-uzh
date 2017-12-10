/* eslint-disable import/no-extraneous-dependencies */

const webpack = require('webpack')

const { ANALYZE } = process.env

module.exports = {
  webpack: (config) => {
    config.plugins.push(new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /de|en/))

    if (ANALYZE) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')

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

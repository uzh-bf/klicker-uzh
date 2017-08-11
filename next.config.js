/* eslint-disable no-param-reassign,import/no-extraneous-dependencies */
// see https://recodes.co/next-js-dotenv/
const { parsed: localEnv } = require('dotenv').config()
const webpack = require('webpack')

module.exports = {
  webpack: (config) => {
    config.plugins.push(new webpack.EnvironmentPlugin(localEnv))
    return config
  },
}

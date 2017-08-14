/* eslint-disable no-param-reassign,import/no-extraneous-dependencies */
// See: https://recodes.co/next-js-dotenv/, https://medium.com/@diamondgfx/nextjs-lessons-learned-part-3-be3aeefd9be0
const webpack = require('webpack')
require('dotenv').config()

module.exports = {
  webpack: (config) => {
    console.log('next custom config loaded...')
    console.dir(process.env.SENTRY)

    // setup mapping of environment variables to process.env
    config.plugins.push(new webpack.EnvironmentPlugin(['LOGROCKET', 'SENTRY']))

    // return the modified config
    return config
  },
}

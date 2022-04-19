const postcss = require('rollup-plugin-postcss')
const autoprefixer = require('autoprefixer')
// const cssnano = require('cssnano')
const tailwindcss = require('tailwindcss')

module.exports = {
  rollup(config, options) {
    config.plugins.push(
      postcss({
        plugins: [tailwindcss(), autoprefixer()],
        inject: false,
        extract: true,
      })
    )
    return config
  },
}

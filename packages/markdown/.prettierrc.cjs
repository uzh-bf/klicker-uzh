module.exports = {
  semi: false,
  singleQuote: true,
  trailingComma: 'es5',
  plugins: [
    // FIXME: currently cannot use tailwindcss together with organize imports (https://github.com/tailwindlabs/prettier-plugin-tailwindcss/issues/31)
    // require('prettier-plugin-tailwindcss'),
    require('prettier-plugin-organize-imports'),
  ],
}

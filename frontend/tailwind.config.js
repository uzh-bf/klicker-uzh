module.exports = {
  purge: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/lib/semantic/dist/**/*.css',
    './node_modules/semantic-ui-react/dist/**/*.js',
  ],
  mode: 'jit',
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {},
  },
  variants: {
    extend: {},
  },
  plugins: [require('@tailwindcss/typography')],
  corePlugins: {
    preflight: false,
  },
}

module.exports = {
  content: ['./src/**/*.tsx', './docs/**/*.mdx', './blog/**/*.mdx'],
  theme: {
    extend: {
      colors: {
        primary: '#dc6027',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}

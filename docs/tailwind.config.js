module.exports = {
  purge: [],
  darkMode: false, // or 'media' or 'class'
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  variants: {
    extend: {},
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

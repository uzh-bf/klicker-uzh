module.exports = {
  purge: ['./src/**/*.{js,ts,jsx,tsx}', './node_modules/semantic-ui-react/dist/**/*.js'],
  mode: 'jit',
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      screens: {
        print: { raw: 'print' },
      },
      colors: {
        'blue-100': '#0028a5',
        'blue-80': '#3353b7',
        'blue-60': '#667ec9',
        'blue-40': '#99a9db',
        'blue-20': '#ccd4ed',
        'grey-100': '#a3adb7',
        'grey-80': '#b5bdc5',
        'grey-60': '#c8ced4',
        'grey-40': '#dadee2',
        'grey-20': '#edeff1',
        'orange-100': '#dc6027',
        'orange-80': '#e38052',
        'orange-60': '#eaa07d',
        'orange-40': '#f1bfa9',
        'orange-20': '#f8dfd4',
        primary: '#7cb8e4',
        'primary-50': '#7cb8e480',
        'primary-20': '#7cb8e433',
        'primary-10': '#7cb8e41a',
        'primary-05': '#7cb8e40d',
        'primary-bg': '#eff6fc',
        'primary-strong': '#375164',
        'primary-input': '#fafdff',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [require('@tailwindcss/typography')],
  corePlugins: {
    preflight: false,
  },
}

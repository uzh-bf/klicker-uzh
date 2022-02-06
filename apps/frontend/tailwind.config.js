module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './node_modules/semantic-ui-react/dist/**/*.js'],
  theme: {
    extend: {
      screens: {
        print: { raw: 'print' },
        xl: '1280px',
        '2xl': '1536px',
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
        'light-grey': '#efefef',
        primary: '#7cb8e4',
        'primary-50': '#7cb8e480',
        'primary-20': '#7cb8e433',
        'primary-10': '#7cb8e41a',
        'primary-05': '#7cb8e40d',
        'primary-bg': '#eff6fc',
        'primary-strong': '#375164',
        'primary-input': '#fafdff',
      },
      flex: {
        '00full': '0 0 100%',
        '00auto': '0 0 auto',
        '00half': '0 0 50%',
        '0020': '0 0 20%',
      },
      backgroundImage: {
        'timeline-desktop':
          'linear-gradient(to bottom, transparent 0%, transparent calc(50% - 0.81px), lightgrey calc(50% - 0.8px), lightgrey calc(50% + 0.8px), transparent calc(50% + 0.81px), transparent 100%)',
        'timeline-mobile':
          'linear-gradient(to right, transparent 0%, transparent calc(50% - 1.01px), lightgrey calc(50% - 1px), lightgrey calc(50% + 1px), transparent calc(50% + 1.01px), transparent 100%)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
  corePlugins: {
    preflight: false,
  },
}

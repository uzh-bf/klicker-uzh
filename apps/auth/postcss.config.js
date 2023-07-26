module.exports = {
  plugins: {
    'postcss-import': {
      addModulesDirectories: ['.', 'shared-components'],
    },
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {}),
  },
}

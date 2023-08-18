module.exports = {
  plugins: {
    'postcss-import': {
      addModulesDirectories: ['.', '@klicker-uzh/shared-components'],
    },
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {}),
  },
}

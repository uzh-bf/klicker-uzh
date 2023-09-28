module.exports = {
  plugins: {
    'postcss-import': {
      addModulesDirectories: [
        '.',
        '@klicker-uzh/shared-components',
        '@uzh-bf/design-system',
      ],
    },
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {}),
  },
}

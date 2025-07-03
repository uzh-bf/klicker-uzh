module.exports = {
  plugins: {
    '@tailwindcss/postcss': {
      addModulesDirectories: [
        '.',
        '@klicker-uzh/shared-components',
        '@uzh-bf/design-system',
      ],
    },
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {}),
  },
}

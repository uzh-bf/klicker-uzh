module.exports = function withNonIncrementalTypescriptOptions(options) {
  return {
    ...options,
    compilerOptions: {
      ...options.compilerOptions,
      incremental: false,
      tsBuildInfoFile: undefined,
    },
  }
}

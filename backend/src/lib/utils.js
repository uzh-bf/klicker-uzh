const exceptTest = (fn) => {
  if (!process.env.NODE_ENV === 'test') {
    fn()
  }
}

const logDebug = (fn) => {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
    fn()
  }
}

const ensureLoaders = (loaders) => {
  if (!loaders) {
    throw new Error('LOADERS_NOT_INITIALIZED')
  }

  return loaders
}

module.exports = {
  exceptTest,
  logDebug,
  ensureLoaders,
}

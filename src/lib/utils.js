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

module.exports = {
  exceptTest,
  logDebug,
}

const exceptTest = (fn) => {
  if (!process.env.NODE_ENV === 'test') {
    fn()
  }
}

module.exports = {
  exceptTest,
}

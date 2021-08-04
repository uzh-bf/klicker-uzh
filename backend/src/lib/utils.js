const path = require('path')
const fs = require('fs')
const caller = require('caller')

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

// load a plain file and return it in string format
// simplified version of https://github.com/Ikos9/require-graphql-file
function loadAsString(fileName) {
  return fs.readFileSync(path.join(path.dirname(caller()), fileName)).toString()
}

module.exports = {
  exceptTest,
  logDebug,
  loadAsString,
}

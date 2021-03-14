const { eslint } = require('@uzh-bf/code-style-react-ts')
module.exports = {
  ...eslint,
  env: {
    browser: true,
    node: true,
    jest: true,
  },
}

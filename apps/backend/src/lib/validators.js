const v8n = require('v8n')
const validator = require('validator')

const { ROLES } = require('@klicker-uzh/db')

v8n.extend({
  // add an email validator based on validator.js
  alphanumeric: () => (str) => validator.isAlphanumeric(str),
  email: () => (str) => validator.isEmail(str),
  role: () => (str) => {
    return Object.values(ROLES).includes(str)
  },
})

module.exports = {
  email: v8n().string().email(),
  shortname: v8n().string().alphanumeric().minLength(3).maxLength(8),
  password: v8n().string().minLength(8),
  institution: v8n().string(),
  useCase: v8n().string(),
  role: v8n().string().role(),
}

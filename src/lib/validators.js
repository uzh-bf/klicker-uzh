const v8n = require('v8n')
const isEmail = require('validator/lib/isEmail')
const isAlphanumeric = require('validator/lib/isAlphanumeric')

v8n.extend({
  // add an email validator based on validator.js
  alphanumeric: () => str => isAlphanumeric(str),
  email: () => str => isEmail(str),
})

module.exports = {
  email: v8n()
    .string()
    .email(),
  shortname: v8n()
    .string()
    .alphanumeric()
    .minLength(3)
    .maxLength(8),
  password: v8n()
    .string()
    .minLength(8),
  institution: v8n().string(),
  useCase: v8n().string(),
}

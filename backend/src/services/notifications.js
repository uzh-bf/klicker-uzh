const rp = require('request-promise')
const nodemailer = require('nodemailer')
const fs = require('fs')
const path = require('path')
const handlebars = require('handlebars')

const CFG = require('../klicker.conf.js')

const APP_CFG = CFG.get('app')
const EMAIL_CFG = CFG.get('email')
const SLACK_CFG = CFG.get('services.slack')
const TEAMS_CFG = CFG.get('services.teams')

/**
 * Send a slack notification (if enabled)
 * @param {String} text The contents to be sent to slack
 */
async function sendSlackNotification(scope, text) {
  console.log(text)

  // check if slack integration is appropriately configured
  if (process.env.NODE_ENV === 'production' && SLACK_CFG.enabled) {
    return rp({
      method: 'POST',
      uri: SLACK_CFG.webhook,
      body: {
        text: `[${scope}] ${text}`,
      },
      json: true,
    })
  }

  // check if teams integration is appropriately configured
  if (process.env.NODE_ENV === 'production' && TEAMS_CFG.enabled) {
    return rp({
      method: 'POST',
      uri: TEAMS_CFG.webhook,
      body: {
        text: `[${scope}] ${text}`,
      },
      json: true,
    })
  }

  return null
}

/**
 * Create a reusable nodemailer transporter using the default SMTP transport
 */
function prepareEmailTransporter() {
  const { host, port, secure, user, password: pass } = EMAIL_CFG
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    requiresAuth: user && pass,
  })
}

/**
 * Load and compile a handlebars template from disk
 * @param {String} templateName The filename of the template
 */
function compileEmailTemplate(templateName, templateParams) {
  const source = fs.readFileSync(path.join(__dirname, 'emails', `${templateName}.hbs`), 'utf8')
  const template = handlebars.compile(source)
  return template({
    baseUrl: `${APP_CFG.secure ? 'https' : 'http'}://${APP_CFG.baseUrl}`,
    ...templateParams,
  })
}

/**
 * Send an email notification to a given address
 * @param {*} transporter
 */
async function sendEmailNotification({ to, subject, html }) {
  if (process.env.NODE_ENV !== 'test') {
    // prepare the email transport
    const transporter = prepareEmailTransporter()

    // send the email
    try {
      await transporter.sendMail({ from: EMAIL_CFG.from, to, subject, html })
    } catch (e) {
      console.log(e)
    }
  }
}

module.exports = {
  sendSlackNotification,
  prepareEmailTransporter,
  compileEmailTemplate,
  sendEmailNotification,
}

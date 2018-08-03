// TODO: extract emails into separate service
const rp = require('request-promise')

const cfg = require('../klicker.conf.js')

const SLACK_CFG = cfg.get('services.slack')

// slack integration
async function sendSlackNotification(text) {
  // check if slack integration is appropriately configured
  if (process.env.NODE_ENV === 'production' && SLACK_CFG.enabled) {
    // console.log(`> Sending slack notification: ${text}`)

    return rp({
      method: 'POST',
      uri: SLACK_CFG.webhook,
      body: {
        text,
      },
      json: true,
    })
  }

  return null
}

module.exports = {
  sendSlackNotification,
}

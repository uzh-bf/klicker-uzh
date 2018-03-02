// TODO: extract emails into separate service
const rp = require('request-promise')

// slack integration
async function sendSlackNotification(text) {
  // check if slack integration is appropriately configured
  if (process.env.NODE_ENV === 'production' && process.env.SLACK_WEBHOOK) {
    return rp({
      method: 'POST',
      uri: process.env.SLACK_WEBHOOK,
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

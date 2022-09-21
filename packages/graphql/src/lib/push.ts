import * as dotenv from 'dotenv'
import webpush from 'web-push'

dotenv.config()

webpush.setVapidDetails(
  'mailto:klicker.support@uzh.ch',
  process.env.VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string
)

const pushSubscription = {
  endpoint: process.env.RS_MOBILE_SUB_ENDPOINT as string,
  keys: {
    auth: process.env.RS_MOBILE_SUB_AUTH as string,
    p256dh: process.env.RS_MOBILE_SUB_P256 as string,
  },
}

webpush.sendNotification(
  pushSubscription,
  JSON.stringify({
    message: 'Neues Microlearning verfügbar',
    title: 'KlickerUZH',
  })
)

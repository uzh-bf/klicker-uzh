import * as dotenv from 'dotenv'
import webpush from 'web-push'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// BF1
// SELECT s.endpoint, s.p256dh, s.auth, p.username
// FROM "PushSubscription" as s
// JOIN "Course" as c ON s."courseId" = c.id
// JOIN "Participant" as p ON s."participantId" = p.id
// WHERE c.name = 'Banking and Finance I'

// AMI
// SELECT s.endpoint, s.p256dh, s.auth, p.username
// FROM "PushSubscription" as s
// JOIN "Course" as c ON s."courseId" = c.id
// JOIN "Participant" as p ON s."participantId" = p.id
// WHERE c.name = 'Asset Management: Investments'

const SUBSCRIPTIONS = []

dotenv.config()

webpush.setVapidDetails(
  'mailto:klicker.support@uzh.ch',
  process.env.VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string
)

// const pushSubscription = {
//   endpoint: process.env.MOBILE_SUB_ENDPOINT as string,
//   keys: {
//     auth: process.env.MOBILE_SUB_AUTH as string,
//     p256dh: process.env.MOBILE_SUB_P256 as string,
//   },
// }

// const result = await webpush.sendNotification(
//   pushSubscription,
//   JSON.stringify({
//     title: '',
//     message: '',
//   })
// )

// console.log(result)

async function sendPushNotifications() {
  for (let sub of SUBSCRIPTIONS) {
    console.log(sub.username)
    await sleep(500)
    try {
      const result = await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth,
            p256dh: sub.p256dh,
          },
        },
        JSON.stringify({
          message:
            'Das Microlearning für BFI Woche 4 ist bis morgen um 09:00 verfügbar.',
          title: 'KlickerUZH - Neues Microlearning',
        })
      )
      console.log(result)
    } catch (e) {
      console.log(e)
    }
  }
}

sendPushNotifications()

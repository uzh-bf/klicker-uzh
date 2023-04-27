import { PushSubscription } from '@klicker-uzh/prisma'
import * as dotenv from 'dotenv'
import webpush from 'web-push'
import { Context } from './context'

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

const SUBSCRIPTIONS: any[] = []

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

export async function sendPushNotificationsToSubscribers(subscriptions: PushSubscription[], ctx: Context) {
  for (let sub of subscriptions) {
    console.log(sub.participantId, sub.courseId, sub.endpoint)
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
            'Das Microlearning für BFI Woche 5 ist bis morgen um 09:00 verfügbar.',
          title: 'KlickerUZH - Neues Microlearning',
        })
      )
      console.log(result)
    } catch (error) {
      console.log("An error occured while trying to send the push notification", error)
      if (error.statusCode === 410) {
        // subscription has expired or is no longer valid
        // remove it from the database
        await ctx.prisma.pushSubscription.delete({
          where: {
            id: sub.id,
          },
        })
      }
    }
  }
}

// sendPushNotifications()

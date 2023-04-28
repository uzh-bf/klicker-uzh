import { MicroSession, MicroSessionStatus, PushSubscription } from '@klicker-uzh/prisma'
import { Context, ContextWithUser } from '../lib/context'
import * as dotenv from 'dotenv'
import webpush from 'web-push'
import result from 'src/ops'
// import { sendPushNotificationsToSubscribers } from '../lib/push'
interface SubscriptionObjectInput {
  endpoint: string
  expirationTime?: number | null | undefined
  keys: {
    p256dh: string
    auth: string
  }
}

interface SubscribeToPushArgs {
  subscriptionObject: SubscriptionObjectInput
  courseId: string
}

export async function subscribeToPush(
  { subscriptionObject, courseId }: SubscribeToPushArgs,
  ctx: ContextWithUser
) {
  console.log("subscriptionObject", subscriptionObject)
  return ctx.prisma.participation.update({
    where: {
      courseId_participantId: { courseId, participantId: ctx.user.sub },
    },
    data: {
      subscriptions: {
        upsert: {
          where: {
            participantId_courseId_endpoint: {
              participantId: ctx.user.sub,
              courseId,
              endpoint: subscriptionObject.endpoint,
            },
          },
          create: {
            endpoint: subscriptionObject.endpoint,
            expirationTime: subscriptionObject.expirationTime,
            p256dh: subscriptionObject.keys.p256dh,
            auth: subscriptionObject.keys.auth,
            course: { connect: { id: courseId } },
            participant: { connect: { id: ctx.user.sub } },
          },
          update: {},
        },
      },
    },
    include: {
      subscriptions: true,
    },
  })
}

export async function sendPushNotifications( ctx: Context) {
  webpush.setVapidDetails(
    'mailto:klicker.support@uzh.ch',
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  )
  
  const microSessions = await ctx.prisma.microSession.findMany({
    where: {
      status: MicroSessionStatus.PUBLISHED,
      scheduledStartAt: {
        lte: new Date(),
      },
      scheduledEndAt: {
        gt: new Date(),
      },
      arePushNotificationsSent: false,
    },
    include: {
      course: true,
      instances: false,
    },
  })

  console.log("Sending push notifications to the following microsessions:", microSessions)

  microSessions.forEach(async (microSession: MicroSession) => {
    const subscriptions = await ctx.prisma.pushSubscription.findMany({
      where: {
        courseId: microSession.courseId,
      },
    })

    console.log("Sending push notifications to the following subscriptions:", subscriptions)
    await sendPushNotificationsToSubscribers(subscriptions, ctx);
    
    // //update microSession to prevent sending push notifications multiple times
    // await ctx.prisma.microSession.update({
    //   where: {
    //     id: microSession.id,
    //   },
    //   data: {
    //     arePushNotificationsSent: true,
    //   },
    // })
  })

  return true
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendPushNotificationsToSubscribers(subscriptions: PushSubscription[], ctx: Context) {
  for (let sub of subscriptions) {
    console.log(sub.participantId, sub.courseId, sub.endpoint)
    await sleep(500)
    const subscription = {
      endpoint: sub.endpoint,
      keys: {
        auth: sub.auth,
        p256dh: sub.p256dh,
      },
    }
    console.log("Sending push notification to the following subscription: ", subscription)
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
      console.log("Push notification sent successfully: ", result)
    } catch (error) {
      console.log("An error occured while trying to send the push notification: ", error)
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
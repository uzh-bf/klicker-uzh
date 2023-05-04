import { MicroSession, MicroSessionStatus, PushSubscription } from '@klicker-uzh/prisma'
import { Context, ContextWithUser } from '../lib/context'
import webpush from 'web-push'

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

interface UnsubscribeToPushArgs {
  courseId: string
  endpoint: string
}

export async function unsubscribeFromPush( 
  { courseId, endpoint }: UnsubscribeToPushArgs,
  ctx: ContextWithUser
) {
  console.log("Unsubscribing from push notifications for the following course with ID: ", courseId)
  console.log("context ctx: ", ctx.user)

  try {
    await ctx.prisma.pushSubscription.delete({
      where: {
        participantId_courseId_endpoint: {
          participantId: ctx.user.sub,
          courseId,
          endpoint
        }
      }
    })
    return true
  } catch(error) {
    console.log("An error occured while trying to unsubscribe from push notifications for the following courseId: ", courseId)
    console.log(error)
    return false
  }
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
      course: {
        include: {
          subscriptions: true,
        },
      },
      instances: false,
    },
  })

  console.log("Sending push notifications to the following microsessions:", microSessions)

 await Promise.all(
    microSessions.map(async (microSession: MicroSession) => {
      try {
        console.log("Sending push notifications to the following subscriptions:", microSession.course.subscriptions)
        await sendPushNotificationsToSubscribers(microSession.course.subscriptions, ctx);
        
        //update microSession to prevent sending push notifications multiple times
        const updatedMicroSession = await ctx.prisma.microSession.update({
          where: {
            id: microSession.id,
          },
          data: {
            arePushNotificationsSent: true,
          },
        })

        console.log("Updated microSession: ", updatedMicroSession)
      } catch (error) {
        console.log("An error occured while trying to send the push notifications to the following subscriptions:", microSession.course.pushSubscription)
        console.log(error)
      }
    })
 )

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
        try {
          // subscription has expired or is no longer valid
          // remove it from the database
          await ctx.prisma.pushSubscription.delete({
            where: {
              id: sub.id,
            },
          })
        } catch (error) {
          console.log("An error occured while trying to remove the expired subscription from the database: ", error)
        }
      }
    }
  }
}
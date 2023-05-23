import { Course, MicroSession, MicroSessionStatus, PushSubscription } from '@klicker-uzh/prisma'
import { Context, ContextWithUser } from '../lib/context'
import { formatDate } from '../lib/util'
import webpush from 'web-push'
import { GraphQLError } from 'graphql';

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
    console.error("An error occured while trying to unsubscribe from push notifications: ", error)
    return false
  }
}

export async function sendPushNotifications( ctx: Context) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new GraphQLError("VAPID keys not available.")
  }

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

  // TODO: improve scalability of push notification dispatch:
  // 1. Investigate implementing this method as a background process to reduce the load on the main thread.
  // 2. Investigate implementing this method in Azure
  await Promise.all(
    microSessions.map(async (microSession: MicroSession) => {
      try {
        await sendPushNotificationsToSubscribers(microSession, ctx);
        
        //update microSession to prevent sending push notifications multiple times
        await ctx.prisma.microSession.update({
          where: {
            id: microSession.id,
          },
          data: {
            arePushNotificationsSent: true,
          },
        })
      } catch (error) {
        console.error("An error occured while trying to send the push notifications: ", error)
      }
    })
 )

  return true
}


async function sendPushNotificationsToSubscribers(microSession: MicroSession, ctx: Context) {
  for (let sub of microSession.course.subscriptions) {  
    try {
      const formattedDate = formatDate(microSession.scheduledEndAt)
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth,
            p256dh: sub.p256dh,
          },
        },
        JSON.stringify({
          message:
            `Das Microlearning ${microSession.displayName} für ${microSession.course.displayName} ist bis am ${formattedDate.date} um ${formattedDate.time} Uhr verfügbar.`,
          title: `KlickerUZH - Neues Microlearning für den Kurs ${microSession.course.name} verfügbar`,
        })
      )
    } catch (error) {
      console.error("An error occured while trying to send the push notification: ", error)
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
          console.error("An error occured while trying to remove the expired subscription from the database: ", error)
        }
      }
    }
  }
}
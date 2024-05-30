import {
  Course,
  MicroLearning,
  PublicationStatus,
  PushSubscription,
} from '@klicker-uzh/prisma'
import { GraphQLError } from 'graphql'
import webpush, { WebPushError } from 'web-push'
import { Context, ContextWithUser } from '../lib/context.js'
import { formatDate } from '../lib/util.js'

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
          endpoint,
        },
      },
    })
    return true
  } catch (error) {
    console.error(
      'An error occured while trying to unsubscribe from push notifications: ',
      error
    )
    return false
  }
}

export async function sendPushNotifications(ctx: Context) {
  if (
    !process.env.VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY ||
    !process.env.NOTIFICATION_SUPPORT_MAIL
  ) {
    throw new GraphQLError('VAPID keys or support email not available.')
  }

  webpush.setVapidDetails(
    `mailto:${process.env.NOTIFICATION_SUPPORT_MAIL as String}`,
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  )

  const microLearnings = await ctx.prisma.microLearning.findMany({
    where: {
      status: PublicationStatus.PUBLISHED,
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
    },
  })

  let allSuccessful = true

  // TODO: improve scalability of push notification dispatch:
  // 1. Investigate implementing this method as a background process to reduce the load on the main thread.
  // 2. Investigate implementing this method in Azure
  await Promise.all(
    microLearnings.map(async (microLearning) => {
      try {
        await sendPushNotificationsToSubscribers(microLearning, ctx)

        //update microLearning to prevent sending push notifications multiple times
        await ctx.prisma.microLearning.update({
          where: {
            id: microLearning.id,
          },
          data: {
            arePushNotificationsSent: true,
          },
        })
      } catch (error) {
        allSuccessful = false
        console.error(
          'An error occured while trying to send the push notifications: ',
          error
        )
      }
    })
  )

  return allSuccessful
}

//TODO: how to address translation of the message when switching to multi language support?
//E.g., store the language on the course entity and use it here to translate the message or
// store the language on the user subscription entity and use this language when sending to the specific user?
async function sendPushNotificationsToSubscribers(
  microLearning: MicroLearning & {
    course: null | (Course & { subscriptions: PushSubscription[] })
  },
  ctx: Context
) {
  for (let sub of microLearning.course?.subscriptions ?? []) {
    try {
      const formattedDate = formatDate(microLearning.scheduledEndAt)
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth,
            p256dh: sub.p256dh,
          },
        },
        JSON.stringify({
          message: `Microlearning ${microLearning.displayName} for ${
            microLearning.course?.displayName ?? ''
          } is available until ${formattedDate.date} at ${formattedDate.time}.`,
          title: `KlickerUZH - New Microlearning available for the course ${
            microLearning.course?.name ?? ''
          }`,
        })
      )
    } catch (error) {
      console.error(
        'An error occured while trying to send the push notification: ',
        error
      )
      if (error instanceof WebPushError && error.statusCode === 410) {
        try {
          // subscription has expired or is no longer valid
          // remove it from the database
          await ctx.prisma.pushSubscription.delete({
            where: {
              id: sub.id,
            },
          })
        } catch (error) {
          console.error(
            'An error occured while trying to remove the expired subscription from the database: ',
            error
          )
        }
      } else {
        throw error
      }
    }
  }
}

import {
  Course,
  MicroSession,
  MicroSessionStatus,
  PushSubscription,
} from '@klicker-uzh/prisma'
import { messaging } from 'firebase-admin'
import { cert, initializeApp } from 'firebase-admin/app'
import { GraphQLError } from 'graphql'
import webpush, { WebPushError } from 'web-push'
import { Context, ContextWithUser } from '../lib/context'
import { formatDate, sliceIntoChunks } from '../lib/util'

interface SubscriptionObjectInput {
  endpoint?: string | null | undefined
  expirationTime?: number | null | undefined
  keys?:
    | {
        p256dh: string
        auth: string
      }
    | null
    | undefined
}

interface SubscribeToPushArgs {
  subscriptionObject?: SubscriptionObjectInput | null | undefined
  token?: string | null | undefined
  isNativePlatform: boolean
  courseId: string
}

export async function subscribeToPush(
  {
    subscriptionObject,
    token,
    isNativePlatform,
    courseId,
  }: SubscribeToPushArgs,
  ctx: ContextWithUser
) {
  if (isNativePlatform && !token) {
    throw new GraphQLError(
      'A registration token is required for native (i.e., Android & iOS) platforms.'
    )
  } else if (!isNativePlatform && !subscriptionObject) {
    throw new GraphQLError(
      'A subscription object is required for web platforms.'
    )
  }

  return ctx.prisma.participation.update({
    where: {
      courseId_participantId: { courseId, participantId: ctx.user.sub },
    },
    data: {
      subscriptions: {
        upsert: isNativePlatform
          ? {
              where: {
                participantId_courseId_token: {
                  participantId: ctx.user.sub,
                  courseId,
                  token: token,
                },
              },
              create: {
                token: token,
                course: { connect: { id: courseId } },
                participant: { connect: { id: ctx.user.sub } },
              },
              update: {},
            }
          : {
              where: {
                participantId_courseId_endpoint: {
                  participantId: ctx.user.sub,
                  courseId,
                  endpoint: subscriptionObject?.endpoint,
                },
              },
              create: {
                endpoint: subscriptionObject?.endpoint,
                expirationTime: subscriptionObject?.expirationTime,
                p256dh: subscriptionObject?.keys?.p256dh,
                auth: subscriptionObject?.keys?.auth,
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
  isNativePlatform: boolean
  endpoint?: string | null | undefined
  token?: string | null | undefined
}

export async function unsubscribeFromPush(
  { courseId, isNativePlatform, endpoint, token }: UnsubscribeToPushArgs,
  ctx: ContextWithUser
) {
  if (isNativePlatform && !token) {
    throw new GraphQLError(
      'The registration token is required to unsubscribe the native client from push notifications.'
    )
  } else if (!isNativePlatform && !endpoint) {
    throw new GraphQLError(
      'The endpoint is required to unsubscribe the web client from push notifications.'
    )
  }
  try {
    await ctx.prisma.pushSubscription.delete({
      where: isNativePlatform
        ? {
            participantId_courseId_token: {
              participantId: ctx.user.sub,
              courseId,
              token,
            },
          }
        : {
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
    !process.env.NOTIFICATION_SUPPORT_MAIL ||
    !process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ) {
    throw new GraphQLError(
      'VAPID keys, support email, or Firebase service account details not available.'
    )
  }

  webpush.setVapidDetails(
    `mailto:${process.env.NOTIFICATION_SUPPORT_MAIL as String}`,
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  )

  const app = initializeApp({
    credential: cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string)
    ),
  })

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
    },
  })

  let allSuccessful = true

  // TODO: improve scalability of push notification dispatch:
  // 1. Investigate implementing this method as a background process to reduce the load on the main thread.
  // 2. Investigate implementing this method in Azure
  await Promise.all(
    microSessions.map(async (microSession) => {
      try {
        await sendPushNotificationsToSubscribers(microSession, ctx)

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
  microSession: MicroSession & {
    course: null | (Course & { subscriptions: PushSubscription[] })
  },
  ctx: Context
) {
  const webClientSubscriptions = microSession.course.subscriptions.filter(
    (sub: PushSubscription) => sub.endpoint
  )
  const nativeClientSubscriptions = microSession.course.subscriptions.filter(
    (sub: PushSubscription) => sub.token
  )

  await sendNotificationsToNativeClients(
    nativeClientSubscriptions,
    microSession,
    ctx
  )
  await sendNotificationsToWebClients(webClientSubscriptions, microSession, ctx)
}

async function sendNotificationsToWebClients(
  subscriptions: PushSubscription[],
  microSession: MicroSession,
  ctx: Context
) {
  if (subscriptions.length === 0) {
    return
  }

  for (let sub of subscriptions) {
    try {
      const formattedDate = formatDate(microSession.scheduledEndAt)
      const response = await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth,
            p256dh: sub.p256dh,
          },
        },
        JSON.stringify({
          message: `Microlearning ${microSession.displayName} for ${
            microSession.course?.displayName ?? ''
          } is available until ${formattedDate.date} at ${formattedDate.time}.`,
          title: `KlickerUZH - New Microlearning available for the course ${
            microSession.course?.name ?? ''
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

async function sendNotificationsToNativeClients(
  subscriptions: PushSubscription[],
  microSession: MicroSession,
  ctx: Context
) {
  if (subscriptions.length === 0) {
    return
  }

  const registrationTokens: string[] = subscriptions.map(
    (sub: PushSubscription) => sub.token
  )

  // only max 500 tokens per request allowed
  const registrationTokenChunks = sliceIntoChunks(registrationTokens, 500)
  const formattedDate = formatDate(microSession.scheduledEndAt)

  for (let tokens of registrationTokenChunks) {
    const message = {
      notification: {
        title: `KlickerUZH - New Microlearning available for the course ${microSession.course.name}`,
        body: `Microlearning ${microSession.displayName} for ${microSession.course.displayName} is available until ${formattedDate.date} at ${formattedDate.time}.`,
      },
      tokens: tokens,
    }

    const response = await messaging().sendEachForMulticast(message)

    if (response.failureCount > 0) {
      const failedTokens: string[] = []
      for (let idx = 0; idx < response.responses.length; idx++) {
        const resp = response.responses[idx]
        if (!resp.success) {
          const failedToken = tokens[idx]
          failedTokens.push(failedToken)

          // Delete token for user if error code is UNREGISTERED or INVALID_ARGUMENT
          if (
            resp.error?.code === 'messaging/invalid-argument' ||
            resp.error?.code === 'messaging/registration-token-not-registered'
          ) {
            try {
              await ctx.prisma.pushSubscription.delete({
                where: {
                  token: failedToken,
                },
              })
            } catch (error) {
              console.log(
                'An error occured while trying to remove the subscription with an invalid token from the database: ',
                error
              )
              throw error
            }
          }
        }
      }
      console.log('List of tokens that caused failures: ' + failedTokens)
    }
  }
}

import { ContextWithUser } from '../lib/context'

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
  return ctx.prisma.pushSubscription.create({
    data: {
      endpoint: subscriptionObject.endpoint,
      expirationTime: subscriptionObject.expirationTime,
      p256dh: subscriptionObject.keys.p256dh,
      auth: subscriptionObject.keys.auth,
      course: { connect: { id: courseId } },
      participation: {
        connect: {
          courseId_participantId: { courseId, participantId: ctx.user.sub },
        },
      },
    },
  })
}

import * as DB from '@klicker-uzh/prisma'
import { filter, pipe } from 'graphql-yoga'

import builder from '../builder'
import { Feedback, SessionBlock } from './session'

export const Subscription = builder.subscriptionType({
  fields(t) {
    const asAuthenticated = t.withAuth({
      authenticated: true,
    })

    const asParticipant = t.withAuth({
      authenticated: true,
      role: DB.UserRole.PARTICIPANT,
    })

    const asUser = t.withAuth({
      authenticated: true,
      role: DB.UserRole.USER,
    })

    return {
      runningSessionUpdated: asUser.prismaField({
        type: SessionBlock,
        args: {
          sessionId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('runningSessionUpdated'),
            filter((data) => data.sessionId === args.sessionId)
          ),
        resolve: (payload) => payload.block,
      }),
      feedbackCreated: t.prismaField({
        type: Feedback,
        args: {
          sessionId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('feedbackCreated'),
            filter((data) => data.sessionId === args.sessionId)
          ),
        resolve: (payload) => payload,
      }),
      feedbackAdded: t.prismaField({
        type: Feedback,
        args: {
          sessionId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('feedbackAdded'),
            filter((data) => data.sessionId === args.sessionId)
          ),
        resolve: (payload) => payload,
      }),
      feedbackRemoved: t.string({
        args: {
          sessionId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('feedbackRemoved'),
            filter((data) => data.sessionId === args.sessionId)
          ),
        resolve: (payload) => payload.id,
      }),
      feedbackUpdated: t.prismaField({
        type: Feedback,
        args: {
          sessionId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('feedbackUpdated'),
            filter((data) => data.sessionId === args.sessionId)
          ),
        resolve: (payload) => payload,
      }),
    }
  },
})

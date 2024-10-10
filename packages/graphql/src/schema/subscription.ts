import { filter, pipe } from 'graphql-yoga'

import builder from '../builder.js'
import { GroupActivityRef } from './groupActivity.js'
import { FeedbackRef, SessionBlockRef } from './session.js'

export const Subscription = builder.subscriptionType({
  fields(t) {
    // const asAuthenticated = t.withAuth({
    //   authenticated: true,
    // })

    // const asParticipant = t.withAuth({
    //   authenticated: true,
    //   role: DB.UserRole.PARTICIPANT,
    // })

    // const asUser = t.withAuth({
    //   authenticated: true,
    //   role: DB.UserRole.USER,
    // })

    return {
      runningSessionUpdated: t.field({
        nullable: true,
        type: SessionBlockRef,
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

      feedbackCreated: t.field({
        type: FeedbackRef,
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

      feedbackAdded: t.field({
        type: FeedbackRef,
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

      feedbackUpdated: t.field({
        type: FeedbackRef,
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

      groupActivityEnded: t.field({
        type: GroupActivityRef,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('groupActivityEnded'),
            filter((data) => data.courseId === args.courseId)
          ),
        resolve: (payload) => payload,
      }),
    }
  },
})

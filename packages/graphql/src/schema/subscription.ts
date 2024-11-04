import { filter, pipe } from 'graphql-yoga'

import builder from '../builder.js'
import { GroupActivityRef } from './groupActivity.js'
import { ElementBlockRef, FeedbackRef } from './liveQuiz.js'
import { MicroLearningRef } from './microLearning.js'

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
      runningLiveQuizUpdated: t.field({
        nullable: true,
        type: ElementBlockRef,
        args: {
          quizId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('runningLiveQuizUpdated'),
            filter((data) => data.liveQuizId === args.quizId)
          ),
        resolve: (payload) => payload.block,
      }),

      feedbackCreated: t.field({
        type: FeedbackRef,
        args: {
          quizId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('feedbackCreated'),
            filter((data) => data.liveQuizId === args.quizId)
          ),
        resolve: (payload) => payload,
      }),

      feedbackAdded: t.field({
        type: FeedbackRef,
        args: {
          quizId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('feedbackAdded'),
            filter((data) => data.liveQuizId === args.quizId)
          ),
        resolve: (payload) => payload,
      }),

      feedbackRemoved: t.string({
        args: {
          quizId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('feedbackRemoved'),
            filter((data) => data.liveQuizId === args.quizId)
          ),
        resolve: (payload) => payload.id,
      }),

      feedbackUpdated: t.field({
        type: FeedbackRef,
        args: {
          quizId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('feedbackUpdated'),
            filter((data) => data.liveQuizId === args.quizId)
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

      groupActivityStarted: t.field({
        type: GroupActivityRef,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('groupActivityStarted'),
            filter((data) => data.courseId === args.courseId)
          ),
        resolve: (payload) => payload,
      }),

      singleGroupActivityEnded: t.field({
        type: GroupActivityRef,
        args: {
          activityId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('singleGroupActivityEnded'),
            filter((data) => data.id === args.activityId)
          ),
        resolve: (payload) => payload,
      }),

      microLearningEnded: t.field({
        type: MicroLearningRef,
        args: {
          activityId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('microLearningEnded'),
            filter((data) => data.id === args.activityId)
          ),
        resolve: (payload) => payload,
      }),
    }
  },
})

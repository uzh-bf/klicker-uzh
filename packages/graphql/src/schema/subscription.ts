import * as DB from '@klicker-uzh/prisma/client'
import type { CodeSubmissionReceipt as CodeSubmissionReceiptType } from '@klicker-uzh/types'
import { filter, pipe } from 'graphql-yoga'

import builder from '../builder.js'
import { CodeSubmissionReceipt } from './code.js'
import { GroupActivityRef } from './groupActivity.js'
import {
  FeedbackRef,
  LiveQuizRef,
  LiveQuizStudentSettingsRef,
} from './liveQuiz.js'
import { MicroLearningRef } from './microLearning.js'

type CodeSubmissionUpdatedEvent = {
  participantId: string
  receipt: CodeSubmissionReceiptType
}

export const Subscription = builder.subscriptionType({
  fields(t) {
    // const asAuthenticated = t.withAuth({
    //   authenticated: true,
    // })

    const asParticipant = {
      authenticated: true,
      role: DB.UserRole.PARTICIPANT,
    }

    // const asUser = t.withAuth({
    //   authenticated: true,
    //   role: DB.UserRole.USER,
    // })

    return {
      codeSubmissionUpdated: t.withAuth(asParticipant).field({
        type: CodeSubmissionReceipt,
        args: { id: t.arg.id({ required: true }) },
        subscribe: (_, args, ctx) => {
          const events = ctx.pubSub.subscribe(
            'codeSubmissionUpdated'
          ) as AsyncIterable<CodeSubmissionUpdatedEvent>
          return pipe(
            events,
            filter(
              (data) =>
                data.receipt.id === String(args.id) &&
                data.participantId === ctx.user?.sub
            )
          )
        },
        resolve: (payload) => payload.receipt,
      }),

      runningLiveQuizUpdated: t.field({
        type: LiveQuizRef,
        args: { id: t.arg.string({ required: true }) },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('runningLiveQuizUpdated'),
            filter((data) => data.id === args.id)
          ),
        resolve: (payload) => payload,
      }),

      liveQuizSettingsChanged: t.field({
        nullable: true,
        type: LiveQuizStudentSettingsRef,
        args: {
          quizId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('liveQuizSettingsChanged'),
            filter((data) => data.liveQuizId === args.quizId)
          ),
        resolve: (payload) => payload,
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

      feedbackPinned: t.field({
        type: FeedbackRef,
        args: {
          quizId: t.arg.string({ required: true }),
        },
        subscribe: (_, args, ctx) =>
          pipe(
            ctx.pubSub.subscribe('feedbackPinned'),
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

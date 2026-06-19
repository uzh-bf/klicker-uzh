import { TRPCError } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import {
  subscribeFeedbackAdded,
  subscribeFeedbackCreated,
  subscribeFeedbackPinned,
  subscribeFeedbackRemoved,
  subscribeFeedbackUpdated,
  subscribeGroupActivityEnded,
  subscribeGroupActivityStarted,
  subscribeLiveQuizSettingsChanged,
  subscribeMicroLearningEnded,
  subscribeRunningLiveQuizUpdated,
  subscribeSingleGroupActivityEnded,
  toFeedbackEvent,
  toGroupActivityEvent,
  toLiveQuizSettingsChangedEvent,
  toMicroLearningEndedEvent,
  toRunningLiveQuizUpdatedEvent,
  type FeedbackEvent,
  type FeedbackSource,
  type GroupActivityEvent,
  type GroupActivitySource,
  type LiveQuizSettingsChangedEvent,
  type LiveQuizSettingsChangedSource,
  type MicroLearningEndedEvent,
  type MicroLearningEndedSource,
  type RunningLiveQuizUpdatedEvent,
  type RunningLiveQuizUpdatedSource,
} from '../../realtime/events.js'
import { publicProcedure, router } from '../init.js'

function createSubscription<TSource, TEvent>(
  source: AsyncIterable<TSource> | null,
  predicate: (value: TSource) => boolean,
  toEvent: (value: TSource) => TEvent
) {
  if (!source) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Realtime event stream unavailable',
    })
  }

  return observable<TEvent>((emit) => {
    const iterator = source[Symbol.asyncIterator]()
    let stopped = false

    void (async () => {
      try {
        while (!stopped) {
          const result = await iterator.next()
          if (result.done) break

          if (predicate(result.value)) {
            emit.next(toEvent(result.value))
          }
        }
      } catch (error) {
        if (!stopped) emit.error(error)
      }
    })()

    return () => {
      stopped = true
      void iterator.return?.()
    }
  })
}

export const realtimeRouter = router({
  feedbackAdded: publicProcedure
    .input(z.object({ quizId: z.string() }))
    .subscription(({ ctx, input }) =>
      createSubscription<FeedbackSource, FeedbackEvent>(
        subscribeFeedbackAdded(ctx.pubSub),
        (feedback) => feedback.liveQuizId === input.quizId,
        toFeedbackEvent
      )
    ),
  feedbackCreated: publicProcedure
    .input(z.object({ quizId: z.string() }))
    .subscription(({ ctx, input }) =>
      createSubscription<FeedbackSource, FeedbackEvent>(
        subscribeFeedbackCreated(ctx.pubSub),
        (feedback) => feedback.liveQuizId === input.quizId,
        toFeedbackEvent
      )
    ),
  feedbackPinned: publicProcedure
    .input(z.object({ quizId: z.string() }))
    .subscription(({ ctx, input }) =>
      createSubscription<FeedbackSource, FeedbackEvent>(
        subscribeFeedbackPinned(ctx.pubSub),
        (feedback) => feedback.liveQuizId === input.quizId,
        toFeedbackEvent
      )
    ),
  feedbackRemoved: publicProcedure
    .input(z.object({ quizId: z.string() }))
    .subscription(({ ctx, input }) =>
      createSubscription<FeedbackSource, FeedbackEvent>(
        subscribeFeedbackRemoved(ctx.pubSub),
        (feedback) => feedback.liveQuizId === input.quizId,
        toFeedbackEvent
      )
    ),
  feedbackUpdated: publicProcedure
    .input(z.object({ quizId: z.string() }))
    .subscription(({ ctx, input }) =>
      createSubscription<FeedbackSource, FeedbackEvent>(
        subscribeFeedbackUpdated(ctx.pubSub),
        (feedback) => feedback.liveQuizId === input.quizId,
        toFeedbackEvent
      )
    ),
  groupActivityEnded: publicProcedure
    .input(z.object({ courseId: z.string() }))
    .subscription(({ ctx, input }) =>
      createSubscription<GroupActivitySource, GroupActivityEvent>(
        subscribeGroupActivityEnded(ctx.pubSub),
        (groupActivity) => groupActivity.courseId === input.courseId,
        toGroupActivityEvent
      )
    ),
  groupActivityStarted: publicProcedure
    .input(z.object({ courseId: z.string() }))
    .subscription(({ ctx, input }) =>
      createSubscription<GroupActivitySource, GroupActivityEvent>(
        subscribeGroupActivityStarted(ctx.pubSub),
        (groupActivity) => groupActivity.courseId === input.courseId,
        toGroupActivityEvent
      )
    ),
  liveQuizSettingsChanged: publicProcedure
    .input(z.object({ quizId: z.string() }))
    .subscription(({ ctx, input }) =>
      createSubscription<
        LiveQuizSettingsChangedSource,
        LiveQuizSettingsChangedEvent
      >(
        subscribeLiveQuizSettingsChanged(ctx.pubSub),
        (settings) => settings.liveQuizId === input.quizId,
        toLiveQuizSettingsChangedEvent
      )
    ),
  microLearningEnded: publicProcedure
    .input(z.object({ activityId: z.string() }))
    .subscription(({ ctx, input }) =>
      createSubscription<MicroLearningEndedSource, MicroLearningEndedEvent>(
        subscribeMicroLearningEnded(ctx.pubSub),
        (microLearning) => microLearning.id === input.activityId,
        toMicroLearningEndedEvent
      )
    ),
  runningLiveQuizUpdated: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) =>
      createSubscription<
        RunningLiveQuizUpdatedSource,
        RunningLiveQuizUpdatedEvent
      >(
        subscribeRunningLiveQuizUpdated(ctx.pubSub),
        (liveQuiz) => liveQuiz.id === input.id,
        toRunningLiveQuizUpdatedEvent
      )
    ),
  singleGroupActivityEnded: publicProcedure
    .input(z.object({ activityId: z.string() }))
    .subscription(({ ctx, input }) =>
      createSubscription<GroupActivitySource, GroupActivityEvent>(
        subscribeSingleGroupActivityEnded(ctx.pubSub),
        (groupActivity) => groupActivity.id === input.activityId,
        toGroupActivityEvent
      )
    ),
})

import { TRPCError } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import {
  subscribeGroupActivityEnded,
  subscribeGroupActivityStarted,
  subscribeMicroLearningEnded,
  subscribeSingleGroupActivityEnded,
  toGroupActivityEvent,
  toMicroLearningEndedEvent,
  type GroupActivityEvent,
  type GroupActivitySource,
  type MicroLearningEndedEvent,
  type MicroLearningEndedSource,
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
  microLearningEnded: publicProcedure
    .input(z.object({ activityId: z.string() }))
    .subscription(({ ctx, input }) =>
      createSubscription<MicroLearningEndedSource, MicroLearningEndedEvent>(
        subscribeMicroLearningEnded(ctx.pubSub),
        (microLearning) => microLearning.id === input.activityId,
        toMicroLearningEndedEvent
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

import { TRPCError } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import {
  subscribeMicroLearningEnded,
  toMicroLearningEndedEvent,
  type MicroLearningEndedEvent,
} from '../../realtime/events.js'
import { publicProcedure, router } from '../init.js'

export const realtimeRouter = router({
  microLearningEnded: publicProcedure
    .input(z.object({ activityId: z.string() }))
    .subscription(({ ctx, input }) => {
      const source = subscribeMicroLearningEnded(ctx.pubSub)

      if (!source) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Realtime event stream unavailable',
        })
      }

      return observable<MicroLearningEndedEvent>((emit) => {
        const iterator = source[Symbol.asyncIterator]()
        let stopped = false

        void (async () => {
          try {
            while (!stopped) {
              const result = await iterator.next()
              if (result.done) break

              if (result.value.id === input.activityId) {
                emit.next(toMicroLearningEndedEvent(result.value))
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
    }),
})

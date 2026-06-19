import { describe, expect, test, vi } from 'vitest'
import {
  publishMicroLearningEnded,
  realtimeEvents,
  type MicroLearningEndedSource,
} from '../../realtime/events.js'
import { appRouter } from '../root.js'

type IteratorResolver<T> = (result: IteratorResult<T>) => void

function createRealtimePubSub<T>() {
  const queue: T[] = []
  const pending: IteratorResolver<T>[] = []
  let closed = false

  return {
    publish: vi.fn((_event: string, payload: T) => {
      const next = pending.shift()
      if (next) {
        next({ value: payload, done: false })
        return
      }

      queue.push(payload)
    }),
    subscribe: vi.fn((_event: string): AsyncIterable<T> => {
      return {
        [Symbol.asyncIterator]() {
          return {
            next(): Promise<IteratorResult<T>> {
              const value = queue.shift()
              if (value) return Promise.resolve({ value, done: false })
              if (closed)
                return Promise.resolve({ value: undefined, done: true })

              return new Promise((resolve) => {
                pending.push(resolve)
              })
            },
            return(): Promise<IteratorResult<T>> {
              closed = true

              while (pending.length > 0) {
                pending.shift()?.({ value: undefined, done: true })
              }

              return Promise.resolve({ value: undefined, done: true })
            },
          }
        },
      }
    }),
  }
}

function createMicroLearning(
  fields: Partial<MicroLearningEndedSource> = {}
): MicroLearningEndedSource {
  return {
    id: 'microlearning-1',
    displayName: 'Microlearning 1',
    scheduledStartAt: new Date('2026-06-19T08:00:00.000Z'),
    scheduledEndAt: new Date('2026-06-19T09:00:00.000Z'),
    ...fields,
  }
}

describe('realtime router', () => {
  test('streams matching microlearning-ended events from the shared pubSub event', async () => {
    const pubSub = createRealtimePubSub<MicroLearningEndedSource>()
    const caller = appRouter.createCaller({ pubSub })

    const stream = await caller.realtime.microLearningEnded({
      activityId: 'microlearning-1',
    })

    const received = new Promise((resolve, reject) => {
      let subscription: { unsubscribe(): void } | undefined

      subscription = stream.subscribe({
        next(value) {
          subscription?.unsubscribe()
          resolve(value)
        },
        error: reject,
      })
    })

    publishMicroLearningEnded(
      pubSub,
      createMicroLearning({ id: 'microlearning-2' })
    )
    publishMicroLearningEnded(pubSub, createMicroLearning())

    await expect(received).resolves.toEqual({
      id: 'microlearning-1',
      displayName: 'Microlearning 1',
      scheduledStartAt: '2026-06-19T08:00:00.000Z',
      scheduledEndAt: '2026-06-19T09:00:00.000Z',
    })
    expect(pubSub.subscribe).toHaveBeenCalledWith(
      realtimeEvents.microLearningEnded
    )
    expect(pubSub.publish).toHaveBeenCalledWith(
      realtimeEvents.microLearningEnded,
      expect.objectContaining({ id: 'microlearning-1' })
    )
  })

  test('fails clearly when no realtime event stream is available', async () => {
    const caller = appRouter.createCaller({})

    await expect(
      caller.realtime.microLearningEnded({ activityId: 'microlearning-1' })
    ).rejects.toThrow('Realtime event stream unavailable')
  })
})

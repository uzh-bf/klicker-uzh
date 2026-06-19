import { describe, expect, test, vi } from 'vitest'
import {
  publishGroupActivityEnded,
  publishGroupActivityStarted,
  publishMicroLearningEnded,
  publishSingleGroupActivityEnded,
  realtimeEvents,
  type GroupActivitySource,
  type MicroLearningEndedSource,
} from '../../realtime/events.js'
import { appRouter } from '../root.js'

type IteratorResolver<T> = (result: IteratorResult<T>) => void

function createRealtimePubSub<T>() {
  const queues = new Map<string, T[]>()
  const pending = new Map<string, IteratorResolver<T>[]>()
  let closed = false

  const getQueue = (event: string) => {
    const queue = queues.get(event) ?? []
    queues.set(event, queue)
    return queue
  }

  const getPending = (event: string) => {
    const eventPending = pending.get(event) ?? []
    pending.set(event, eventPending)
    return eventPending
  }

  return {
    publish: vi.fn((event: string, payload: T) => {
      const next = getPending(event).shift()
      if (next) {
        next({ value: payload, done: false })
        return
      }

      getQueue(event).push(payload)
    }),
    subscribe: vi.fn((event: string): AsyncIterable<T> => {
      return {
        [Symbol.asyncIterator]() {
          return {
            next(): Promise<IteratorResult<T>> {
              const value = getQueue(event).shift()
              if (value) return Promise.resolve({ value, done: false })
              if (closed)
                return Promise.resolve({ value: undefined, done: true })

              return new Promise((resolve) => {
                getPending(event).push(resolve)
              })
            },
            return(): Promise<IteratorResult<T>> {
              closed = true

              pending.forEach((eventPending) => {
                while (eventPending.length > 0) {
                  eventPending.shift()?.({ value: undefined, done: true })
                }
              })

              return Promise.resolve({ value: undefined, done: true })
            },
          }
        },
      }
    }),
  }
}

function receiveNext<T>(stream: {
  subscribe(observer: { next(value: T): void; error(error: unknown): void }): {
    unsubscribe(): void
  }
}) {
  return new Promise<T>((resolve, reject) => {
    let subscription: { unsubscribe(): void } | undefined

    subscription = stream.subscribe({
      next(value) {
        subscription?.unsubscribe()
        resolve(value)
      },
      error: reject,
    })
  })
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

function createGroupActivity(
  fields: Partial<GroupActivitySource> = {}
): GroupActivitySource {
  return {
    id: 'group-activity-1',
    courseId: 'course-1',
    displayName: 'Group activity 1',
    status: 'PUBLISHED',
    description: 'Collaborative case',
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

    const received = receiveNext(stream)

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

  test('streams matching group-activity events from the shared pubSub events', async () => {
    const pubSub = createRealtimePubSub<GroupActivitySource>()
    const caller = appRouter.createCaller({ pubSub })

    const startedStream = await caller.realtime.groupActivityStarted({
      courseId: 'course-1',
    })
    const endedStream = await caller.realtime.groupActivityEnded({
      courseId: 'course-1',
    })
    const singleEndedStream = await caller.realtime.singleGroupActivityEnded({
      activityId: 'group-activity-1',
    })

    const started = receiveNext(startedStream)
    const ended = receiveNext(endedStream)
    const singleEnded = receiveNext(singleEndedStream)

    publishGroupActivityStarted(
      pubSub,
      createGroupActivity({ id: 'group-activity-2', courseId: 'course-2' })
    )
    publishGroupActivityEnded(
      pubSub,
      createGroupActivity({ id: 'group-activity-2', courseId: 'course-2' })
    )
    publishSingleGroupActivityEnded(
      pubSub,
      createGroupActivity({ id: 'group-activity-2' })
    )

    publishGroupActivityStarted(pubSub, createGroupActivity())
    publishGroupActivityEnded(pubSub, createGroupActivity())
    publishSingleGroupActivityEnded(pubSub, createGroupActivity())

    const expected = {
      id: 'group-activity-1',
      courseId: 'course-1',
      displayName: 'Group activity 1',
      status: 'PUBLISHED',
      description: 'Collaborative case',
      scheduledStartAt: '2026-06-19T08:00:00.000Z',
      scheduledEndAt: '2026-06-19T09:00:00.000Z',
    }

    await expect(started).resolves.toEqual(expected)
    await expect(ended).resolves.toEqual(expected)
    await expect(singleEnded).resolves.toEqual(expected)

    expect(pubSub.subscribe).toHaveBeenCalledWith(
      realtimeEvents.groupActivityStarted
    )
    expect(pubSub.subscribe).toHaveBeenCalledWith(
      realtimeEvents.groupActivityEnded
    )
    expect(pubSub.subscribe).toHaveBeenCalledWith(
      realtimeEvents.singleGroupActivityEnded
    )
  })
})

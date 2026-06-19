export const realtimeEvents = {
  microLearningEnded: 'microLearningEnded',
} as const

export type MicroLearningEndedSource = {
  id: string
  displayName: string
  scheduledStartAt: Date | string | null
  scheduledEndAt: Date | string | null
}

export type MicroLearningEndedEvent = {
  id: string
  displayName: string
  scheduledStartAt: string
  scheduledEndAt: string
}

type PubSubPublisher = {
  publish(event: string, payload: unknown): unknown
}

type PubSubSubscriber = {
  subscribe(event: string): AsyncIterable<unknown>
}

function hasPublish(pubSub: unknown): pubSub is PubSubPublisher {
  return (
    pubSub !== null &&
    typeof pubSub === 'object' &&
    'publish' in pubSub &&
    typeof (pubSub as PubSubPublisher).publish === 'function'
  )
}

function hasSubscribe(pubSub: unknown): pubSub is PubSubSubscriber {
  return (
    pubSub !== null &&
    typeof pubSub === 'object' &&
    'subscribe' in pubSub &&
    typeof (pubSub as PubSubSubscriber).subscribe === 'function'
  )
}

export function toMicroLearningEndedEvent(
  microLearning: MicroLearningEndedSource
): MicroLearningEndedEvent {
  return {
    id: microLearning.id,
    displayName: microLearning.displayName,
    scheduledStartAt: serializeEventDate(
      microLearning.scheduledStartAt,
      'scheduledStartAt'
    ),
    scheduledEndAt: serializeEventDate(
      microLearning.scheduledEndAt,
      'scheduledEndAt'
    ),
  }
}

function serializeEventDate(
  value: Date | string | null,
  fieldName: string
): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value

  throw new Error(`microLearningEnded.${fieldName} is required`)
}

export function publishMicroLearningEnded(
  pubSub: unknown,
  microLearning: MicroLearningEndedSource
) {
  if (!hasPublish(pubSub)) return

  return pubSub.publish(realtimeEvents.microLearningEnded, microLearning)
}

export function subscribeMicroLearningEnded(pubSub: unknown) {
  if (!hasSubscribe(pubSub)) return null

  return pubSub.subscribe(
    realtimeEvents.microLearningEnded
  ) as AsyncIterable<MicroLearningEndedSource>
}

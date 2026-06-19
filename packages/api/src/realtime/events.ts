export const realtimeEvents = {
  groupActivityEnded: 'groupActivityEnded',
  groupActivityStarted: 'groupActivityStarted',
  microLearningEnded: 'microLearningEnded',
  singleGroupActivityEnded: 'singleGroupActivityEnded',
} as const

export type RealtimeEventName =
  (typeof realtimeEvents)[keyof typeof realtimeEvents]

type ActivityDate = Date | string | null

export type GroupActivitySource = {
  id: string
  courseId: string
  displayName: string
  status: string
  description: string | null
  scheduledStartAt: ActivityDate
  scheduledEndAt: ActivityDate
}

export type GroupActivityEvent = {
  id: string
  courseId: string
  displayName: string
  status: string
  description: string | null
  scheduledStartAt: string
  scheduledEndAt: string
}

export type MicroLearningEndedSource = {
  id: string
  displayName: string
  scheduledStartAt: ActivityDate
  scheduledEndAt: ActivityDate
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

export function toGroupActivityEvent(
  groupActivity: GroupActivitySource
): GroupActivityEvent {
  return {
    id: groupActivity.id,
    courseId: groupActivity.courseId,
    displayName: groupActivity.displayName,
    status: groupActivity.status,
    description: groupActivity.description,
    scheduledStartAt: serializeEventDate(
      groupActivity.scheduledStartAt,
      'scheduledStartAt'
    ),
    scheduledEndAt: serializeEventDate(
      groupActivity.scheduledEndAt,
      'scheduledEndAt'
    ),
  }
}

function serializeEventDate(value: ActivityDate, fieldName: string): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value

  throw new Error(`realtime.${fieldName} is required`)
}

function publishEvent(
  pubSub: unknown,
  event: RealtimeEventName,
  payload: unknown
) {
  if (!hasPublish(pubSub)) return

  return pubSub.publish(event, payload)
}

function subscribeEvent<T>(pubSub: unknown, event: RealtimeEventName) {
  if (!hasSubscribe(pubSub)) return null

  return pubSub.subscribe(event) as AsyncIterable<T>
}

export function publishMicroLearningEnded(
  pubSub: unknown,
  microLearning: MicroLearningEndedSource
) {
  return publishEvent(pubSub, realtimeEvents.microLearningEnded, microLearning)
}

export function publishGroupActivityStarted(
  pubSub: unknown,
  groupActivity: GroupActivitySource
) {
  return publishEvent(
    pubSub,
    realtimeEvents.groupActivityStarted,
    groupActivity
  )
}

export function publishGroupActivityEnded(
  pubSub: unknown,
  groupActivity: GroupActivitySource
) {
  return publishEvent(pubSub, realtimeEvents.groupActivityEnded, groupActivity)
}

export function publishSingleGroupActivityEnded(
  pubSub: unknown,
  groupActivity: GroupActivitySource
) {
  return publishEvent(
    pubSub,
    realtimeEvents.singleGroupActivityEnded,
    groupActivity
  )
}

export function subscribeMicroLearningEnded(pubSub: unknown) {
  return subscribeEvent<MicroLearningEndedSource>(
    pubSub,
    realtimeEvents.microLearningEnded
  )
}

export function subscribeGroupActivityStarted(pubSub: unknown) {
  return subscribeEvent<GroupActivitySource>(
    pubSub,
    realtimeEvents.groupActivityStarted
  )
}

export function subscribeGroupActivityEnded(pubSub: unknown) {
  return subscribeEvent<GroupActivitySource>(
    pubSub,
    realtimeEvents.groupActivityEnded
  )
}

export function subscribeSingleGroupActivityEnded(pubSub: unknown) {
  return subscribeEvent<GroupActivitySource>(
    pubSub,
    realtimeEvents.singleGroupActivityEnded
  )
}

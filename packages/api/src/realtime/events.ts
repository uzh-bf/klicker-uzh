export const realtimeEvents = {
  feedbackAdded: 'feedbackAdded',
  feedbackCreated: 'feedbackCreated',
  feedbackPinned: 'feedbackPinned',
  feedbackRemoved: 'feedbackRemoved',
  feedbackUpdated: 'feedbackUpdated',
  groupActivityEnded: 'groupActivityEnded',
  groupActivityStarted: 'groupActivityStarted',
  liveQuizSettingsChanged: 'liveQuizSettingsChanged',
  microLearningEnded: 'microLearningEnded',
  runningLiveQuizUpdated: 'runningLiveQuizUpdated',
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

export type RunningLiveQuizUpdatedSource = {
  id: string
  beforeFirstBlock?: boolean | null
  activeBlock?: unknown
  blocks?: unknown
}

export type RunningLiveQuizUpdatedEvent = {
  id: string
}

export type LiveQuizSettingsChangedSource = {
  liveQuizId: string
  isLiveQAEnabled: boolean
  isConfusionFeedbackEnabled: boolean
}

export type LiveQuizSettingsChangedEvent = LiveQuizSettingsChangedSource

export type FeedbackSource = {
  id: number
  liveQuizId: string | null
}

export type FeedbackEvent = {
  id: number
  liveQuizId: string
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

export function toRunningLiveQuizUpdatedEvent(
  liveQuiz: RunningLiveQuizUpdatedSource
): RunningLiveQuizUpdatedEvent {
  return { id: liveQuiz.id }
}

export function toLiveQuizSettingsChangedEvent(
  settings: LiveQuizSettingsChangedSource
): LiveQuizSettingsChangedEvent {
  return {
    liveQuizId: settings.liveQuizId,
    isLiveQAEnabled: settings.isLiveQAEnabled,
    isConfusionFeedbackEnabled: settings.isConfusionFeedbackEnabled,
  }
}

export function toFeedbackEvent(feedback: FeedbackSource): FeedbackEvent {
  if (!feedback.liveQuizId) {
    throw new Error('realtime.feedback.liveQuizId is required')
  }

  return {
    id: feedback.id,
    liveQuizId: feedback.liveQuizId,
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

export function publishRunningLiveQuizUpdated(
  pubSub: unknown,
  liveQuiz: RunningLiveQuizUpdatedSource
) {
  return publishEvent(pubSub, realtimeEvents.runningLiveQuizUpdated, liveQuiz)
}

export function publishLiveQuizSettingsChanged(
  pubSub: unknown,
  settings: LiveQuizSettingsChangedSource
) {
  return publishEvent(pubSub, realtimeEvents.liveQuizSettingsChanged, settings)
}

export function publishFeedbackAdded(
  pubSub: unknown,
  feedback: FeedbackSource
) {
  return publishEvent(pubSub, realtimeEvents.feedbackAdded, feedback)
}

export function publishFeedbackCreated(
  pubSub: unknown,
  feedback: FeedbackSource
) {
  return publishEvent(pubSub, realtimeEvents.feedbackCreated, feedback)
}

export function publishFeedbackPinned(
  pubSub: unknown,
  feedback: FeedbackSource
) {
  return publishEvent(pubSub, realtimeEvents.feedbackPinned, feedback)
}

export function publishFeedbackRemoved(
  pubSub: unknown,
  feedback: FeedbackSource
) {
  return publishEvent(pubSub, realtimeEvents.feedbackRemoved, feedback)
}

export function publishFeedbackUpdated(
  pubSub: unknown,
  feedback: FeedbackSource
) {
  return publishEvent(pubSub, realtimeEvents.feedbackUpdated, feedback)
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

export function subscribeRunningLiveQuizUpdated(pubSub: unknown) {
  return subscribeEvent<RunningLiveQuizUpdatedSource>(
    pubSub,
    realtimeEvents.runningLiveQuizUpdated
  )
}

export function subscribeLiveQuizSettingsChanged(pubSub: unknown) {
  return subscribeEvent<LiveQuizSettingsChangedSource>(
    pubSub,
    realtimeEvents.liveQuizSettingsChanged
  )
}

export function subscribeFeedbackAdded(pubSub: unknown) {
  return subscribeEvent<FeedbackSource>(pubSub, realtimeEvents.feedbackAdded)
}

export function subscribeFeedbackCreated(pubSub: unknown) {
  return subscribeEvent<FeedbackSource>(pubSub, realtimeEvents.feedbackCreated)
}

export function subscribeFeedbackPinned(pubSub: unknown) {
  return subscribeEvent<FeedbackSource>(pubSub, realtimeEvents.feedbackPinned)
}

export function subscribeFeedbackRemoved(pubSub: unknown) {
  return subscribeEvent<FeedbackSource>(pubSub, realtimeEvents.feedbackRemoved)
}

export function subscribeFeedbackUpdated(pubSub: unknown) {
  return subscribeEvent<FeedbackSource>(pubSub, realtimeEvents.feedbackUpdated)
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

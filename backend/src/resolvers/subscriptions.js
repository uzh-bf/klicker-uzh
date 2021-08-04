const { PubSub, withFilter } = require('graphql-subscriptions')
const { RedisPubSub } = require('graphql-redis-subscriptions')
const { newRedis } = require('../redis')

let pubsub

const redis = newRedis(3)
if (redis) {
  // instantiate a new redis-based pubsub instance
  pubsub = new RedisPubSub({ publisher: redis, subscriber: newRedis(3) })
} else {
  pubsub = new PubSub()
}

// filter out feedbacks for the requested session
const compareSessionId = (payload, variables) => payload.sessionId === variables.sessionId

/* ----- subscriptions ----- */
const FEEDBACK_ADDED = 'feedbackAdded'
const feedbackAddedSubscription = {
  // resolve: {},
  subscribe: withFilter(() => pubsub.asyncIterator(FEEDBACK_ADDED), compareSessionId),
}

const CONFUSION_ADDED = 'confusionAdded'
const confusionAddedSubscription = {
  subscribe: withFilter(() => pubsub.asyncIterator(CONFUSION_ADDED), compareSessionId),
}

const SESSION_UPDATED = 'sessionUpdated'
const sessionUpdatedSubscription = {
  subscribe: withFilter(() => pubsub.asyncIterator(SESSION_UPDATED), compareSessionId),
}

const RUNNING_SESSION_UPDATED = 'runningSessionUpdated'
const runningSessionUpdatedSubscription = {
  subscribe: withFilter(() => pubsub.asyncIterator(RUNNING_SESSION_UPDATED), compareSessionId),
}

module.exports = {
  // export the pubsub interface
  pubsub,

  // export subscriptions
  confusionAdded: confusionAddedSubscription,
  feedbackAdded: feedbackAddedSubscription,
  sessionUpdated: sessionUpdatedSubscription,
  runningSessionUpdated: runningSessionUpdatedSubscription,

  // export subscription types
  CONFUSION_ADDED,
  FEEDBACK_ADDED,
  SESSION_UPDATED,
  RUNNING_SESSION_UPDATED,
}

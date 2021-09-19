const { PubSub, withFilter } = require('graphql-subscriptions')
const { RedisPubSub } = require('graphql-redis-subscriptions')
const { getRedis, newRedis } = require('../redis')

let pubsub

const redis = getRedis('redis')
if (redis) {
  // instantiate a new redis-based pubsub instance
  pubsub = new RedisPubSub({ publisher: redis, subscriber: newRedis('redis') })
} else {
  pubsub = new PubSub()
}

// filter out feedbacks for the requested session
const compareSessionId = (payload, variables) => payload.sessionId === variables.sessionId

/* ----- subscriptions ----- */
function subscriptionWithSessionId(subscriptionType) {
  return {
    subscribe: withFilter(() => pubsub.asyncIterator(subscriptionType), compareSessionId),
  }
}

const subscriptionTypes = {
  CONFUSION_ADDED: 'confusionAdded',
  FEEDBACK_ADDED: 'feedbackAdded',
  PUBLIC_FEEDBACK_ADDED: 'publicFeedbackAdded',
  SESSION_UPDATED: 'sessionUpdated',
  RUNNING_SESSION_UPDATED: 'runningSessionUpdated',
}

module.exports = {
  // export the pubsub interface
  pubsub,

  // export subscriptions
  confusionAdded: subscriptionWithSessionId(subscriptionTypes.CONFUSION_ADDED),
  publicFeedbackAdded: subscriptionWithSessionId(subscriptionTypes.PUBLIC_FEEDBACK_ADDED),
  feedbackAdded: subscriptionWithSessionId(subscriptionTypes.FEEDBACK_ADDED),
  sessionUpdated: subscriptionWithSessionId(subscriptionTypes.SESSION_UPDATED),
  runningSessionUpdated: subscriptionWithSessionId(subscriptionTypes.RUNNING_SESSION_UPDATED),

  // export subscription types
  ...subscriptionTypes,
}

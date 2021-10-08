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
  FEEDBACK_RESOLVED: 'feedbackResolved',
  FEEDBACK_DELETED: 'feedbackDeleted',
  FEEDBACK_RESPONSE_ADDED: 'feedbackResponseAdded',
  FEEDBACK_RESPONSE_DELETED: 'feedbackResponseDeleted',
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
  feedbackResolved: subscriptionWithSessionId(subscriptionTypes.FEEDBACK_RESOLVED),
  feedbackDeleted: subscriptionWithSessionId(subscriptionTypes.FEEDBACK_DELETED),
  feedbackResponseAdded: subscriptionWithSessionId(subscriptionTypes.FEEDBACK_RESPONSE_ADDED),
  feedbackResponseDeleted: subscriptionWithSessionId(subscriptionTypes.FEEDBACK_RESPONSE_DELETED),
  sessionUpdated: subscriptionWithSessionId(subscriptionTypes.SESSION_UPDATED),
  runningSessionUpdated: subscriptionWithSessionId(subscriptionTypes.RUNNING_SESSION_UPDATED),

  // export subscription types
  ...subscriptionTypes,
}

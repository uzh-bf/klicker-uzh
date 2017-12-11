const md5 = require('md5')

const { QuestionInstanceModel, UserModel } = require('../models')
const { QuestionGroups, QuestionTypes } = require('../constants')

const { getRedis } = require('../redis')
const { getRunningSession } = require('./sessionMgr')

// initialize redis if available
const redis = getRedis(2)

// add a new feedback to a session
const addFeedback = async ({ sessionId, content }) => {
  // TODO: security
  // TODO: redis?
  // TODO: ...

  const session = await getRunningSession(sessionId)

  // if the feedback channel is not activated, do not allow new additions
  if (!session.settings.isFeedbackChannelActive) {
    throw new Error('SESSION_FEEDBACKS_DEACTIVATED')
  }

  // push a new feedback into the array
  session.feedbacks.push({ content })

  // save the updated session
  await session.save()

  // return the updated session
  return session
}

// delete a feedback from a session
const deleteFeedback = async ({ sessionId, feedbackId, userId }) => {
  const session = await getRunningSession(sessionId)

  // ensure the user is authorized to modify this session
  if (!session.user.equals(userId)) {
    throw new Error('UNAUTHORIZED')
  }

  session.feedbacks = session.feedbacks.filter(feedback => feedback.id !== feedbackId)

  // save the updated session
  await session.save()

  // return the updated session
  return session
}

// add a new confusion timestep to the session
const addConfusionTS = async ({
  ip, fp, sessionId, difficulty, speed,
}) => {
  // TODO: security
  // TODO: redis?
  // TODO: ...

  // if redis is available, put the new confusion data in the store
  if (redis) {
    const result = redis.hset(`${sessionId}:confusion`, fp || ip, { difficulty, speed })
    console.log(result)
  }

  const session = await getRunningSession(sessionId)

  // if the confusion barometer is not activated, do not allow new additions
  if (!session.settings.isConfusionBarometerActive) {
    throw new Error('SESSION_CONFUSION_DEACTIVATED')
  }

  // push a new timestep into the array
  session.confusionTS.push({ difficulty, speed })

  // save the updated session
  await session.save()

  // return the updated session
  return session
}

// add a response to an active question instance
const addResponse = async ({
  ip, fp, instanceId, response,
}) => {
  // if redis is available, check if any matching response (ip or fp) is already in the database.
  // if so, throw an error
  if (redis) {
    // results should still be written to the database? but responses will not be saved seperately!
    // or only write results to db every 5 or 10 responses and use redis as calculation platform?

    // if redis is available, save the ip, fp and response under the key of the corresponding instance
    const ipAdded = redis.sadd(`${instanceId}:ip`, ip)
    const fpAdded = redis.sadd(`${instanceId}:fp`, fp)
    const results = await Promise.all([ipAdded, fpAdded])

    if (results[0] && results[1]) {
      // add the response to the redis database
      redis.rpush(`${instanceId}:responses`, JSON.stringify({ response }))
    } else {
      // add the response to the redis database
      redis.rpush(`${instanceId}:dropped`, JSON.stringify({ response }))

      throw new Error('ALREADY_RESPONDED')
    }
  }

  // find the specified question instance
  // only find instances that are open
  const instance = await QuestionInstanceModel.findOne({ _id: instanceId, isOpen: true }).populate('question')

  // if the instance is closed, don't allow adding any responses
  if (!instance) {
    throw new Error('INSTANCE_CLOSED')
  }

  const questionType = instance.question.type
  const currentVersion = instance.question.versions[instance.version]

  // result parsing for SC/MC questions
  if (QuestionGroups.CHOICES.includes(questionType)) {
    // if the response doesn't contain any valid choices, throw
    if (!response.choices || !response.choices.length > 0) {
      throw new Error('INVALID_RESPONSE')
    }

    // if the response contains multiple choices for an MC question
    if (questionType === QuestionTypes.SC && response.choices.length > 1) {
      throw new Error('TOO_MANY_CHOICES')
    }

    // if it is the very first response, initialize results
    if (!instance.results) {
      instance.results = {
        CHOICES: new Array(currentVersion.options[questionType].choices.length).fill(+0),
        totalParticipants: 0,
      }
    }

    // for each choice given, update the results
    response.choices.forEach((responseIndex) => {
      instance.results.CHOICES[responseIndex] += 1
    })
    instance.results.totalParticipants += 1
    instance.markModified('results.CHOICES')
  } else if (QuestionGroups.FREE.includes(questionType)) {
    if (!response.value) {
      throw new Error('INVALID_RESPONSE')
    }

    if (
      questionType === QuestionTypes.FREE_RANGE &&
      (response.value < currentVersion.options.FREE_RANGE.restrictions.min ||
        response.value > currentVersion.options.FREE_RANGE.restrictions.max)
    ) {
      throw new Error('RESPONSE_OUT_OF_RANGE')
    }

    // if it is the very first response, initialize results
    if (!instance.results) {
      instance.results = {
        FREE: {},
        totalParticipants: 0,
      }
    }

    // hash the response value to get a unique identifier
    const resultKey = md5(response.value)

    // if the respective response value was not given before, add it anew
    if (!instance.results.FREE[resultKey]) {
      instance.results.FREE[resultKey] = {
        count: 1,
        value: response.value,
      }
    } else {
      // if the response value already occurred, simply increment count
      instance.results.FREE[resultKey].count += 1
    }
    instance.results.totalParticipants += 1
    instance.markModified('results.FREE')
  }

  // TODO: remove saving single responses in the database
  instance.responses.push({
    ip,
    fingerprint: fp,
    value: response,
  })

  // save the updated instance
  await instance.save()

  // return the updated instance
  return instance
}

const joinSession = async ({ shortname }) => {
  // TODO: add test
  // find the user with the given shortname
  const user = await UserModel.findOne({ shortname }).populate([
    {
      path: 'runningSession',
      populate: {
        path: 'activeInstances',
        populate: {
          path: 'question',
        },
      },
    },
  ])

  const {
    id, activeInstances, settings, feedbacks,
  } = user.runningSession

  return {
    id,
    settings,
    // map active instances to be in the correct format
    activeQuestions: activeInstances.map((instance) => {
      const { id: instanceId, question } = instance
      const version = question.versions[instance.version]

      return {
        id: question.id,
        instanceId,
        title: question.title,
        type: question.type,
        description: version.description,
        options: version.options,
      }
    }),
    feedbacks: settings.isFeedbackChannelActive && settings.isFeedbackChannelPublic ? feedbacks : null,
  }
}

module.exports = {
  getRunningSession,
  addResponse,
  addConfusionTS,
  addFeedback,
  deleteFeedback,
  joinSession,
}

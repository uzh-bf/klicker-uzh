const md5 = require('md5')
const _isNumber = require('lodash/isNumber')
const { ForbiddenError, UserInputError } = require('apollo-server-express')

const { QuestionInstanceModel, UserModel, FileModel } = require('../models')
const { QUESTION_GROUPS, QUESTION_TYPES } = require('../constants')
const { getRedis } = require('../redis')
const { getRunningSession } = require('./sessionMgr')
const {
  pubsub,
  CONFUSION_ADDED,
  FEEDBACK_ADDED,
} = require('../resolvers/subscriptions')

// initialize redis if available
const redis = getRedis(2)

// add a new feedback to a session
const addFeedback = async ({ sessionId, content }) => {
  const session = await getRunningSession(sessionId)

  // if the feedback channel is not activated, do not allow new additions
  if (!session.settings.isFeedbackChannelActive) {
    throw new ForbiddenError('SESSION_FEEDBACKS_DEACTIVATED')
  }

  // push a new feedback into the array
  session.feedbacks.push({ content })

  // save the updated session
  await session.save()

  // extract the saved feedback and convert it to a plain object
  // then readd the mongo _id field under the id key and publish the result
  // this is needed as redis swallows the _id field and the client could break!
  const savedFeedback = session.feedbacks[
    session.feedbacks.length - 1
  ].toObject()
  pubsub.publish(FEEDBACK_ADDED, {
    [FEEDBACK_ADDED]: { ...savedFeedback, id: savedFeedback._id },
    sessionId,
  })

  // return the updated session
  return session
}

// delete a feedback from a session
const deleteFeedback = async ({ sessionId, feedbackId, userId }) => {
  const session = await getRunningSession(sessionId)

  // ensure the user is authorized to modify this session
  if (!session.user.equals(userId)) {
    throw new ForbiddenError('UNAUTHORIZED')
  }

  session.feedbacks = session.feedbacks.filter(
    feedback => feedback.id !== feedbackId,
  )

  // save the updated session
  await session.save()

  // return the updated session
  return session
}

// add a new confusion timestep to the session
const addConfusionTS = async ({ sessionId, difficulty, speed }) => {
  const session = await getRunningSession(sessionId)

  // if the confusion barometer is not activated, do not allow new additions
  if (!session.settings.isConfusionBarometerActive) {
    throw new ForbiddenError('SESSION_CONFUSION_DEACTIVATED')
  }

  // push a new timestep into the array
  session.confusionTS.push({ difficulty, speed })

  // save the updated session
  await session.save()

  // extract the saved confusion timestep and convert it to a plain object
  // then readd the mongo _id field under the id key and publish the result
  // this is needed as redis swallows the _id field and the client could break!
  const savedConfusion = session.confusionTS[
    session.confusionTS.length - 1
  ].toObject()
  pubsub.publish(CONFUSION_ADDED, {
    [CONFUSION_ADDED]: { ...savedConfusion, id: savedConfusion._id },
    sessionId,
  })

  // return the updated session
  return session
}

// add a response to an active question instance
const addResponse = async ({
  ip, fp, instanceId, response,
}) => {
  // response object to save
  const saveResponse = {
    createdAt: Date.now(),
    value: response,
  }

  // if redis is available, save the ip, fp and response under the key of the corresponding instance
  // also check if any matching response (ip or fp) is already in the database.
  // TODO: results should still be written to the database? but responses will not be saved seperately!
  if (redis && (process.env.APP_FILTERING_IP || process.env.APP_FILTERING_FP)) {
    // prepare a redis pipeline
    const pipeline = redis.pipeline()

    const dropResponse = () => {
      // add the dropped response to the redis database
      redis.rpush(`${instanceId}:dropped`, JSON.stringify({ response }))

      // if strict filtering fails, drop here
      throw new ForbiddenError('ALREADY_RESPONDED')
    }

    // if ip filtering is enabled, try adding the ip to redis
    if (process.env.APP_FILTERING_IP) {
      pipeline.sadd(`${instanceId}:ip`, ip)
    }

    // if fingerprinting is enabled, try adding the fingerprint to redis
    if (process.env.APP_FILTERING_FP) {
      pipeline.sadd(`${instanceId}:fp`, fp)
    }

    const results = await pipeline.exec()

    // if ip filtering is enabled, parse the results
    let startIndex = 0
    if (process.env.APP_FILTERING_IP) {
      const ipUnique = results[0][1]

      // if filtering is strict, drop on non unique
      if (process.env.APP_FILTERING_IP_STRICT && !ipUnique) {
        dropResponse()
      }

      // otherwise save the flag in the response
      saveResponse.ipUnique = ipUnique

      // increment startIndex such that the fp check knows which result to take
      startIndex = 1
    }

    // if fp filtering is enabled, parse the results
    if (process.env.APP_FILTERING_FP) {
      const fpUnique = results[startIndex][1]

      // if filtering is strict, drop on non unique
      if (process.env.APP_FILTERING_FP_STRICT && !fpUnique) {
        dropResponse()
      }

      // otherwise save the flag in the response
      saveResponse.fpUnique = fpUnique
    }

    // add the response to the redis database
    redis.rpush(`${instanceId}:responses`, JSON.stringify(saveResponse))
  }

  // find the specified question instance
  // only find instances that are open
  const instance = await QuestionInstanceModel.findOne({
    _id: instanceId,
    isOpen: true,
  }).populate('question')

  // if the instance is closed, don't allow adding any responses
  if (!instance) {
    throw new ForbiddenError('INSTANCE_CLOSED')
  }

  const questionType = instance.question.type
  const currentVersion = instance.question.versions[instance.version]

  // result parsing for SC/MC questions
  if (QUESTION_GROUPS.CHOICES.includes(questionType)) {
    // if the response doesn't contain any valid choices, throw
    if (!response.choices || !response.choices.length > 0) {
      throw new UserInputError('INVALID_RESPONSE')
    }

    // if the response contains multiple choices for a SC question
    if (questionType === QUESTION_TYPES.SC && response.choices.length > 1) {
      throw new UserInputError('TOO_MANY_CHOICES')
    }

    // if it is the very first response, initialize results
    if (!instance.results) {
      instance.results = {
        CHOICES: new Array(
          currentVersion.options[questionType].choices.length,
        ).fill(+0),
        totalParticipants: 0,
      }
    }

    // for each choice given, update the results
    response.choices.forEach((responseIndex) => {
      instance.results.CHOICES[responseIndex] += 1
    })
    instance.results.totalParticipants += 1
    instance.markModified('results.CHOICES')
  } else if (QUESTION_GROUPS.FREE.includes(questionType)) {
    if (!response.value || response.value.length > 1000) {
      throw new UserInputError('INVALID_RESPONSE')
    }

    if (questionType === QUESTION_TYPES.FREE_RANGE) {
      if (!_isNumber(response.value * 1)) {
        throw new UserInputError('INVALID_RESPONSE')
      }

      // validate that the response lies within the specified range if given
      const { min, max } = currentVersion.options.FREE_RANGE.restrictions
      if ((min && response.value < min) || (max && response.value > max)) {
        throw new UserInputError('RESPONSE_OUT_OF_RANGE')
      }
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

  // TODO: remove saving single responses in the database?
  instance.responses.push(saveResponse)

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

      // get the files that correspond to the current question version
      const files = FileModel.find({ _id: { $in: version.files } })

      return {
        id: question.id,
        instanceId,
        title: question.title,
        type: question.type,
        content: version.content,
        description: version.description,
        options: version.options,
        files,
      }
    }),
    feedbacks:
      settings.isFeedbackChannelActive && settings.isFeedbackChannelPublic
        ? feedbacks
        : null,
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

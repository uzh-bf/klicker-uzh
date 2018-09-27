const md5 = require('md5')
const v8n = require('v8n')
const { ForbiddenError, UserInputError } = require('apollo-server-express')

const CFG = require('../klicker.conf.js')
const { QuestionInstanceModel, UserModel, FileModel } = require('../models')
const { QUESTION_GROUPS, QUESTION_TYPES } = require('../constants')
const { getRedis } = require('../redis')
const { getRunningSession } = require('./sessionMgr')
const { pubsub, CONFUSION_ADDED, FEEDBACK_ADDED } = require('../resolvers/subscriptions')

const FILTERING_CFG = CFG.get('security.filtering')

// initialize redis if available
// const responseControl = getRedis(2)
const responseCache = getRedis(3)

/**
 * Add a new feedback to a session
 * @param {*} param0
 */
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
  const savedFeedback = session.feedbacks[session.feedbacks.length - 1].toObject()
  pubsub.publish(FEEDBACK_ADDED, {
    [FEEDBACK_ADDED]: { ...savedFeedback, id: savedFeedback._id },
    sessionId,
  })

  // return the updated session
  return session
}

/**
 * Delete a feedback from a session
 * @param {*} param0
 */
const deleteFeedback = async ({ sessionId, feedbackId, userId }) => {
  const session = await getRunningSession(sessionId)

  // ensure the user is authorized to modify this session
  if (!session.user.equals(userId)) {
    throw new ForbiddenError('UNAUTHORIZED')
  }

  session.feedbacks = session.feedbacks.filter(feedback => feedback.id !== feedbackId)

  // save the updated session
  await session.save()

  // return the updated session
  return session
}

/**
 * Add a new confusion timestep to the session
 * @param {*} param0
 */
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
  const savedConfusion = session.confusionTS[session.confusionTS.length - 1].toObject()
  pubsub.publish(CONFUSION_ADDED, {
    [CONFUSION_ADDED]: { ...savedConfusion, id: savedConfusion._id },
    sessionId,
  })

  // return the updated session
  return session
}

/**
 * Add a response to an active question instance
 * @param {*} param0
 */
const addResponse = async ({ ip, fp, instanceId, response }) => {
  // ensure that a response cache is available
  if (!responseCache) {
    throw new Error('REDIS_NOT_AVAILABLE')
  }

  // extract important instance information from the corresponding redis hash
  const { status, type, min, max } = await responseCache.hgetall(`instance:${instanceId}:info`)

  // ensure that the instance targeted is actually running
  // this approach allows us to not have to fetch the instance from the database at all
  if (status !== 'OPEN') {
    throw new ForbiddenError('INSTANCE_CLOSED')
  }

  // prepare a redis transaction pipeline to batch all actions into an atomic transaction
  const transaction = responseCache.multi()

  if (QUESTION_GROUPS.CHOICES.includes(type)) {
    // if the response doesn't contain any valid choices, throw
    if (!response.choices || !response.choices.length > 0) {
      throw new UserInputError('INVALID_RESPONSE')
    }

    // if the response contains multiple choices for a SC question
    if (type === QUESTION_TYPES.SC && response.choices.length > 1) {
      throw new UserInputError('TOO_MANY_CHOICES')
    }

    // for each choice in the response, increment the corresponding hash key
    response.choices.forEach(choiceIndex => {
      transaction.hincrby(`instance:${instanceId}:results`, choiceIndex, 1)
    })
  } else if (QUESTION_GROUPS.FREE.includes(type)) {
    // validate that a response value has been passed and that it is not extremely long
    if (!response.value || response.value.length > 1000) {
      throw new UserInputError('INVALID_RESPONSE')
    }

    // validate whether the numerical answer respects the defined ranges
    if (type === QUESTION_TYPES.FREE_RANGE) {
      // create a new base validator
      // disallow NaN by passing false
      const baseValidator = v8n().number(false)

      try {
        baseValidator.check(+response.value)
      } catch (e) {
        throw new UserInputError('INVALID_RESPONSE')
      }

      let rangeValidator = baseValidator
      if (min) {
        rangeValidator = rangeValidator.greaterThanOrEqual(min)
      }
      if (max) {
        rangeValidator = rangeValidator.lessThanOrEqual(max)
      }

      try {
        rangeValidator.check(+response.value)
      } catch (e) {
        throw new UserInputError('RESPONSE_OUT_OF_RANGE')
      }
    }

    // hash the response value to get a unique identifier
    const resultKey = md5(response.value)

    // hash the open response value and add it to the redis hash
    // or increment if the hashed value already exists in the cache
    transaction.hincrby(`instance:${instanceId}:results`, resultKey, 1)

    // cache the response value <-> hash mapping
    transaction.hset(`instance:${instanceId}:responseHashes`, resultKey, response.value)
  }

  // if ip filtering is enabled, add the ip to the redis respondent set
  if (FILTERING_CFG.byIP.enabled && ip) {
    transaction.sadd(`instance:${instanceId}:ip`, ip)
  }

  // if fingerprinting is enabled, add the fingerprint to the redis respondent set
  if (FILTERING_CFG.byFP.enabled && fp) {
    transaction.sadd(`instance:${instanceId}:fp`, fp)
  }

  // add the response to the list of responses
  transaction.rpush(`instance:${instanceId}:responses`, JSON.stringify({ ip, fp, response }))

  // increment the number of participants by one
  transaction.hincrby(`instance:${instanceId}:results`, 'participants', 1)

  // as we are based on redis, leave early (no db access at all)
  return transaction.exec()

  // if redis is available, save the ip, fp and response under the key of the corresponding instance
  // also check if any matching response (ip or fp) is already in the database.
  // TODO: results should still be written to the database? but responses will not be saved seperately!
  /* if (redis && (FILTERING_CFG.byIP.enabled || FILTERING_CFG.byFP.enabled)) {
    // prepare a redis pipeline
    const pipeline = redis.pipeline()

    const dropResponse = () => {
      // add the dropped response to the redis database
      redis.rpush(`${instanceId}:dropped`, JSON.stringify({ response }))

      // if strict filtering fails, drop here
      throw new ForbiddenError('ALREADY_RESPONDED')
    }

    // if ip filtering is enabled, try adding the ip to redis
    if (FILTERING_CFG.byIP.enabled) {
      pipeline.sadd(`${instanceId}:ip`, ip)
    }

    // if fingerprinting is enabled, try adding the fingerprint to redis
    if (FILTERING_CFG.byFP.enabled) {
      pipeline.sadd(`${instanceId}:fp`, fp)
    }

    const results = await pipeline.exec()

    // if ip filtering is enabled, parse the results
    let startIndex = 0
    if (FILTERING_CFG.byIP.enabled) {
      const ipUnique = results[0][1]

      // if filtering is strict, drop on non unique
      if (FILTERING_CFG.byIP.strict && !ipUnique) {
        dropResponse()
      }

      // otherwise save the flag in the response
      saveResponse.ipUnique = ipUnique

      // increment startIndex such that the fp check knows which result to take
      startIndex = 1
    }

    // if fp filtering is enabled, parse the results
    if (FILTERING_CFG.byFP.enabled) {
      const fpUnique = results[startIndex][1]

      // if filtering is strict, drop on non unique
      if (FILTERING_CFG.byFP.strict && !fpUnique) {
        dropResponse()
      }

      // otherwise save the flag in the response
      saveResponse.fpUnique = fpUnique
    }

    // add the response to the redis database
    redis.rpush(`${instanceId}:responses`, JSON.stringify(saveResponse))
  } */
}

/**
 * Remove a response from an active question instance
 * @param {*} param0
 */
const deleteResponse = async ({ userId, instanceId, response }) => {
  // find the specified question instance
  // only find instances that are open
  const instance = await QuestionInstanceModel.findOne({
    _id: instanceId,
    user: userId,
  }).populate('question')

  // if the instance does not exist, throw
  if (!instance) {
    throw new ForbiddenError('INVALID_INSTANCE')
  }

  // hash the response value to get a unique identifier
  const resultKey = md5(response)

  // if the instance is not open, it must have been executed already
  if (!instance.isOpen) {
    if (!instance.results) {
      throw new ForbiddenError('NO_RESULTS_AVAILABLE')
    }

    const questionType = instance.question.type

    // ensure that this operation is only executed on free response questions
    if (!QUESTION_GROUPS.FREE.includes(questionType)) {
      throw new ForbiddenError('OPERATION_INCOMPATIBLE')
    }

    // remove the responses with the corresponding result key
    const result = instance.results.FREE[resultKey]
    if (result) {
      delete instance.results.FREE[resultKey]
      instance.results.totalParticipants -= result.count
    }
    instance.markModified('results.FREE')
    instance.markModified('results.totalParticipants')

    return instance.save()
  }

  // extract the count of responses for the key to delete
  const count = await responseCache.hget(`instance:${instanceId}:results`, resultKey)

  // if the instance is open, the result needs to be removed from redis
  return responseCache
    .multi()
    .hdel(`instance:${instanceId}:results`, resultKey)
    .hincrby(`instance:${instanceId}:results`, 'participants', -count)
    .exec()
}

/**
 * Prepare data needed for participating in a session
 * @param {*} param0
 */
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

  if (!user || !user.runningSession) {
    return null
  }

  const { id, activeInstances, settings, feedbacks } = user.runningSession

  return {
    id,
    settings,
    // map active instances to be in the correct format
    activeInstances: activeInstances.map(({ id: instanceId, question, version: instanceVersion }) => {
      const version = question.versions[instanceVersion]

      // get the files that correspond to the current question version
      const files = FileModel.find({ _id: { $in: version.files } })

      return {
        questionId: question.id,
        id: instanceId,
        title: question.title,
        type: question.type,
        content: version.content,
        description: version.description,
        options: version.options,
        files,
      }
    }),
    feedbacks: settings.isFeedbackChannelActive && settings.isFeedbackChannelPublic ? feedbacks : null,
  }
}

module.exports = {
  getRunningSession,
  addResponse,
  deleteResponse,
  addConfusionTS,
  addFeedback,
  deleteFeedback,
  joinSession,
}

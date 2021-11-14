const md5 = require('md5')
const v8n = require('v8n')
const _trim = require('lodash/trim')
const JWT = require('jsonwebtoken')
const { ForbiddenError, UserInputError } = require('apollo-server-express')
const { v5: uuidv5 } = require('uuid')
const mongoose = require('mongoose')
const dayjs = require('dayjs')
const { sortBy } = require('ramda')

const { ObjectId } = mongoose.Types

const CFG = require('../klicker.conf.js')
const { QuestionInstanceModel, UserModel, FileModel, SessionModel } = require('../models')
const { QUESTION_GROUPS, QUESTION_TYPES, SESSION_STATUS, SESSION_STORAGE_MODE } = require('../constants')
const { getRedis } = require('../redis')
const { getRunningSession, cleanCache, publishSessionUpdate } = require('./sessionMgr')
const {
  pubsub,
  FEEDBACK_ADDED,
  PUBLIC_FEEDBACK_ADDED,
  PUBLIC_FEEDBACK_REMOVED,
  FEEDBACK_DELETED,
  FEEDBACK_RESOLVED,
  FEEDBACK_RESPONSE_ADDED,
  FEEDBACK_RESPONSE_DELETED,
  CONFUSION_ADDED,
} = require('../resolvers/subscriptions')
const { AUTH_COOKIE_SETTINGS } = require('./accounts')

const APP_CFG = CFG.get('app')

// initialize redis if available
// const responseControl = getRedis(2)
const responseCache = getRedis('exec')

/**
 * Add a new feedback to a session
 * @param {*} param0
 */
const addFeedback = async ({ sessionId, content }) => {
  // TODO: participant auth

  const session = await getRunningSession(sessionId)

  // if the feedback channel is not activated, do not allow new additions
  if (!session.settings.isFeedbackChannelActive) {
    throw new ForbiddenError('SESSION_FEEDBACKS_DEACTIVATED')
  }

  // push a new feedback into the array
  session.feedbacks.push({ content, published: session.settings.isFeedbackChannelPublic })

  // save the updated session
  await session.save()

  // extract the saved feedback and convert it to a plain object
  // then readd the mongo _id field under the id key and publish the result
  // this is needed as redis swallows the _id field and the client could break!
  const savedFeedback = session.feedbacks[session.feedbacks.length - 1].toObject()
  const savedFeedbackWithId = { ...savedFeedback, id: savedFeedback._id }

  pubsub.publish(FEEDBACK_ADDED, {
    [FEEDBACK_ADDED]: savedFeedbackWithId,
    sessionId,
  })

  // if the feedback channel is public, publish the feedback directly
  // otherwise, it will need to be published after moderation
  if (session.settings.isFeedbackChannelPublic) {
    pubsub.publish(PUBLIC_FEEDBACK_ADDED, {
      [PUBLIC_FEEDBACK_ADDED]: savedFeedbackWithId,
      sessionId,
    })
  }

  // return the updated session
  return savedFeedbackWithId
}

function assertUserMatch(session, userId) {
  // ensure the user is authorized to modify this session
  if (!session.user.equals(userId)) {
    throw new ForbiddenError('UNAUTHORIZED')
  }
}

async function pinFeedback({ sessionId, feedbackId, userId, pinState }) {
  const session = await getRunningSession(sessionId)

  assertUserMatch(session, userId)

  const updatedSession = await SessionModel.findOneAndUpdate(
    {
      _id: sessionId,
      'feedbacks._id': feedbackId,
    },
    {
      $set: {
        'feedbacks.$.pinned': pinState,
      },
    },
    { new: true }
  )

  return updatedSession
}

async function publishFeedback({ sessionId, feedbackId, userId, publishState }) {
  const session = await getRunningSession(sessionId)

  assertUserMatch(session, userId)

  const updatedSession = await SessionModel.findOneAndUpdate(
    {
      _id: sessionId,
      'feedbacks._id': feedbackId,
    },
    {
      $set: {
        'feedbacks.$.published': publishState,
      },
    },
    {
      new: true,
    }
  )

  // if the feedback is newly published, send it out via subscription
  if (publishState) {
    const savedFeedback = updatedSession.feedbacks.find((feedback) => feedback._id.toString() === feedbackId).toObject()
    const savedFeedbackWithId = { ...savedFeedback, id: savedFeedback._id }
    pubsub.publish(PUBLIC_FEEDBACK_ADDED, {
      [PUBLIC_FEEDBACK_ADDED]: savedFeedbackWithId,
      sessionId,
    })
  } else {
    pubsub.publish(PUBLIC_FEEDBACK_REMOVED, {
      [PUBLIC_FEEDBACK_REMOVED]: feedbackId,
      sessionId,
    })
  }

  return updatedSession
}

async function resolveFeedback({ sessionId, feedbackId, userId, resolvedState }) {
  const session = await getRunningSession(sessionId)

  assertUserMatch(session, userId)

  const updatedSession = await SessionModel.findOneAndUpdate(
    {
      _id: sessionId,
      'feedbacks._id': feedbackId,
    },
    resolvedState
      ? {
          $set: {
            'feedbacks.$.resolved': resolvedState,
            'feedbacks.$.pinned': false,
          },
          $currentDate: {
            'feedbacks.$.resolvedAt': true,
          },
        }
      : {
          'feedbacks.$.resolved': resolvedState,
          'feedbacks.$.resolvedAt': null,
        },
    { new: true }
  )

  pubsub.publish(FEEDBACK_RESOLVED, {
    [FEEDBACK_RESOLVED]: {
      feedbackId,
      resolvedState,
      resolvedAt: resolvedState ? new Date() : null,
    },
    sessionId,
  })

  return updatedSession
}

async function respondToFeedback({ sessionId, feedbackId, userId, response }) {
  const session = await getRunningSession(sessionId)

  assertUserMatch(session, userId)

  const newResponseId = ObjectId()

  const updatedSession = await SessionModel.findOneAndUpdate(
    {
      _id: sessionId,
      'feedbacks._id': feedbackId,
    },
    {
      $push: {
        'feedbacks.$.responses': { _id: newResponseId, content: response },
      },
      $set: {
        'feedbacks.$.resolved': true,
        'feedbacks.$.pinned': false,
        'feedbacks.$.published': true,
      },
      $currentDate: {
        'feedbacks.$.resolvedAt': true,
      },
    },
    {
      new: true,
    }
  )

  pubsub.publish(FEEDBACK_RESPONSE_ADDED, {
    [FEEDBACK_RESPONSE_ADDED]: {
      feedbackId,
      id: newResponseId,
      content: response,
      createdAt: new Date(),
      resolvedAt: new Date(),
    },
    sessionId,
  })

  return updatedSession
}

async function upvoteFeedback({ sessionId, feedbackId, undo }) {
  // TODO: fingerprinting

  await SessionModel.findOneAndUpdate(
    {
      _id: sessionId,
    },
    {
      $inc: {
        'feedbacks.$[fb].votes': undo ? -1 : 1,
      },
    },
    {
      arrayFilters: [{ 'fb._id': feedbackId }],
    }
  )

  return feedbackId
}

async function reactToFeedbackResponse({ sessionId, feedbackId, responseId, positive, negative }) {
  // TODO: fingerprinting

  const increments = {}
  if (positive) {
    increments['feedbacks.$[fb].responses.$[res].positiveReactions'] = positive > 0 ? 1 : -1
  }
  if (negative) {
    increments['feedbacks.$[fb].responses.$[res].negativeReactions'] = negative < 0 ? -1 : 1
  }

  await SessionModel.findOneAndUpdate(
    {
      _id: sessionId,
    },
    {
      $inc: increments,
    },
    {
      arrayFilters: [{ 'fb._id': feedbackId }, { 'res._id': responseId }],
    }
  )

  return feedbackId
}

async function deleteFeedbackResponse({ sessionId, feedbackId, userId, responseId }) {
  const session = await getRunningSession(sessionId)

  assertUserMatch(session, userId)

  const updatedSession = await SessionModel.findOneAndUpdate(
    {
      _id: sessionId,
      'feedbacks._id': feedbackId,
    },
    {
      $pull: {
        'feedbacks.$.responses': { _id: responseId },
      },
    },
    {
      new: true,
    }
  )

  // publish the deletion
  pubsub.publish(FEEDBACK_RESPONSE_DELETED, {
    [FEEDBACK_RESPONSE_DELETED]: {
      id: responseId,
      feedbackId,
    },
    sessionId,
  })

  return updatedSession
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

  const updatedSession = await SessionModel.findOneAndUpdate(
    {
      _id: sessionId,
    },
    {
      $pull: {
        feedbacks: { _id: feedbackId },
      },
    },
    {
      new: true,
    }
  )

  pubsub.publish(FEEDBACK_DELETED, {
    [FEEDBACK_DELETED]: feedbackId,
    sessionId,
  })

  // return the updated session
  return updatedSession
}

/**
 * Add a new confusion timestep to the session
 * @param {*} param0
 */
const addConfusionTS = async ({ sessionId, difficulty, speed }) => {
  // TODO: participant auth
  const session = await getRunningSession(sessionId)

  // if the confusion barometer is not activated, do not allow new additions
  if (!session.settings.isConfusionBarometerActive) {
    throw new ForbiddenError('SESSION_CONFUSION_DEACTIVATED')
  }

  // push a new timestep into the array
  session.confusionTS.push({ difficulty, speed })

  const filteredConfusion = session.confusionTS.filter(
    (element) => dayjs().diff(dayjs(element.createdAt), 'minute') <= 10
  )
  let speedRunning = 0
  let difficultyRunning = 0

  speedRunning =
    filteredConfusion.reduce((previousValue, currentValue) => previousValue + (currentValue.speed + 1) * 0.5, 0) /
    filteredConfusion.length
  difficultyRunning =
    filteredConfusion.reduce((previousValue, currentValue) => previousValue + (currentValue.difficulty + 1) * 0.5, 0) /
    filteredConfusion.length

  if (Number.isNaN(speedRunning)) {
    speedRunning = 0.5
  }
  if (Number.isNaN(difficultyRunning)) {
    difficultyRunning = 0.5
  }
  // overwrite confusionTS data sent to user by filtered and aggregated values
  session.confusionValues = { speed: speedRunning, difficulty: difficultyRunning }

  // readd mongoDB id-field
  session.id = session._id
  session.blocks.forEach((block) => {
    // eslint-disable-next-line no-param-reassign
    block.id = block._id
  })

  // add the computed confusion values to the subscribtion content and
  // then readd the mongo _id field under the id key and publish the result
  // this is needed as redis swallows the _id field and the client could break!
  const savedConfusion = session.confusionTS[session.confusionTS.length - 1].toObject()

  pubsub.publish(CONFUSION_ADDED, {
    [CONFUSION_ADDED]: { speed: speedRunning, difficulty: difficultyRunning, id: savedConfusion._id },
    sessionId,
  })

  // save the updated session
  await session.save()
  // return the updated session
  return session
}

const computeParticipantIdentifier = (authToken, namespace) => {
  if (typeof authToken === 'undefined' || typeof authToken.sub === 'undefined') {
    return null
  }

  if (authToken.aai) {
    if (typeof namespace === 'undefined') {
      return null
    }

    return uuidv5(authToken.sub, namespace)
  }

  return authToken.sub
}

/**
 * Add a response to an active question instance
 * @param {*} param0
 */
const addResponse = async ({ instanceId, response, auth: authToken }) => {
  // ensure that a response cache is available
  if (!responseCache) {
    throw new Error('REDIS_NOT_AVAILABLE')
  }

  const instanceKey = `instance:${instanceId}`

  // extract important instance information from the corresponding redis hash
  const { auth, status, type, min, max, mode, namespace } = await responseCache.hgetall(`${instanceKey}:info`)

  // ensure that the instance targeted is actually running
  // this approach allows us to not have to fetch the instance from the database at all
  if (status !== 'OPEN') {
    throw new ForbiddenError('INSTANCE_CLOSED')
  }

  // prepare a redis transaction pipeline to batch all actions into an atomic transaction
  const transaction = responseCache.multi()

  // if authentication is enabled for the session with the current instance
  // check if the current participant has already responded and exit early if so
  if (auth === 'true') {
    const participantIdentifier = computeParticipantIdentifier(authToken, namespace)

    // ensure that a participant id is available (i.e., the participant has logged in)
    if (!participantIdentifier) {
      throw new ForbiddenError('MISSING_PARTICIPANT_ID')
    }

    // ensure that the participant has not already voted
    const isAuthorizedToVote = await responseCache.sismember(`${instanceKey}:participantList`, participantIdentifier)
    const hasAlreadyVoted = await responseCache.sismember(`${instanceKey}:participants`, participantIdentifier)
    if (!isAuthorizedToVote || hasAlreadyVoted) {
      // if we are using authentication and the responses should be stored
      if (mode === SESSION_STORAGE_MODE.COMPLETE) {
        await responseCache.rpush(
          `${instanceKey}:dropped`,
          JSON.stringify({ response, participant: participantIdentifier })
        )
      }
      throw new ForbiddenError('RESPONSE_NOT_ALLOWED')
    }

    // add the participant to the set of participants that have voted
    transaction.sadd(`${instanceKey}:participants`, participantIdentifier)
  }

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
    response.choices.forEach((choiceIndex) => {
      transaction.hincrby(`${instanceKey}:results`, choiceIndex, 1)
    })
  } else if (QUESTION_GROUPS.FREE.includes(type)) {
    // validate that a response value has been passed and that it is not extremely long
    if (!response.value || response.value.length > 1000) {
      throw new UserInputError('INVALID_RESPONSE')
    }

    let resultKey
    let resultValue

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

      // hash the response value to get a unique identifier
      resultValue = response.value
      resultKey = md5(resultValue)
    } else {
      if (response.length === 0) {
        throw new UserInputError('RESPONSE_EMPTY')
      }

      // hash the response value to get a unique identifier
      resultValue = _trim(response.value.toLowerCase())
      resultKey = md5(resultValue)
    }

    // hash the open response value and add it to the redis hash
    // or increment if the hashed value already exists in the cache
    transaction.hincrby(`${instanceKey}:results`, resultKey, 1)

    // cache the response value <-> hash mapping
    transaction.hset(`${instanceKey}:responseHashes`, resultKey, resultValue)
  }

  if (mode === SESSION_STORAGE_MODE.COMPLETE) {
    transaction.rpush(
      `${instanceKey}:responses`,
      JSON.stringify({ response, participant: authToken ? authToken.sub : undefined })
    )
  }

  // increment the number of participants by one
  transaction.hincrby(`${instanceKey}:results`, 'participants', 1)

  // as we are based on redis, leave early (no db access at all)
  return transaction.exec()
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
 *
 * @param {*} res
 */
const loginParticipant = async ({ res, sessionId, username, password }) => {
  const session = await SessionModel.findOne({ _id: sessionId, status: SESSION_STATUS.RUNNING })
  if (!session) {
    throw new ForbiddenError('INVALID_SESSION')
  }

  // check if we have a participant with the given username and password
  const participantIndex = session.participants.findIndex(
    (p) => typeof p.password !== 'undefined' && p.username === username && p.password === password
  )
  if (participantIndex === -1) {
    throw new ForbiddenError('INVALID_PARTICIPANT_LOGIN')
  }

  // participant has logged in, get the relevant data
  const participant = session.participants[participantIndex]

  // set a token for the participant
  const jwt = JWT.sign(
    {
      expiresIn: 86400,
      sub: participant.id,
      scope: ['PARTICIPANT'],
      session: session.id,
      aai: false,
    },
    APP_CFG.secret,
    {
      algorithm: 'HS256',
      expiresIn: '1w',
    }
  )

  // set a cookie with the generated JWT
  if (res && res.cookie) {
    res.cookie('jwt', jwt, AUTH_COOKIE_SETTINGS)
  }

  return participant.id
}

function verifyParticipantAuthentication({ auth, authenticationMode, id, participants }) {
  const participantIdentifier = auth ? auth.sub : undefined

  if (
    typeof participantIdentifier === 'undefined' ||
    !auth.scope.includes('PARTICIPANT') ||
    auth.session !== id.toString()
  ) {
    throw new UserInputError('INVALID_PARTICIPANT_LOGIN', { id, authenticationMode })
  }

  if (
    (auth.aai && !participants.map((participant) => participant.username).includes(participantIdentifier)) ||
    (!auth.aai && !participants.map((participant) => participant.id).includes(participantIdentifier))
  ) {
    throw new UserInputError('SESSION_NOT_ACCESSIBLE', { id, authenticationMode })
  }
}

/**
 * Prepare data needed for participating in a session
 * @param {*} param0
 */
const joinSession = async ({ shortname, auth }) => {
  // find the user with the given shortname
  const user = await UserModel.findOne({ shortname }).populate('runningSession')
  if (!user || !user.runningSession) {
    return null
  }

  // populate the running session with active instance and question details
  const runningSession = await SessionModel.findById(user.runningSession.id).populate({
    path: `blocks.${user.runningSession.activeBlock}.instances`,
    populate: {
      path: 'question',
    },
  })

  const { id, activeBlock, blocks, settings, status, participants } = runningSession
  const currentBlock = blocks[activeBlock] || { instances: [] }

  if (settings.isParticipantAuthenticationEnabled) {
    verifyParticipantAuthentication({ auth, authenticationMode: settings.authenticationMode, id, participants })
  }

  return {
    id,
    settings,
    status,
    isFeedbackOnlySession: blocks.length === 0,
    expiresAt: currentBlock.expiresAt,
    timeLimit: currentBlock.timeLimit,
    // map active instances to be in the correct format
    activeInstances: currentBlock.instances
      .filter((instance) => instance.isOpen)
      .map(({ id: instanceId, question, version: instanceVersion }) => {
        const version = question.versions[instanceVersion]

        // get the files that correspond to the current question version
        const files = FileModel.find({ _id: { $in: version.files } })

        return {
          execution: currentBlock.execution,
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
  }
}

async function joinQA({ shortname, auth }) {
  // find the user with the given shortname
  const user = await UserModel.findOne({ shortname }).populate('runningSession')
  if (!user || !user.runningSession) {
    return null
  }

  const { id, settings, feedbacks, participants } = user.runningSession

  if (settings.isParticipantAuthenticationEnabled) {
    verifyParticipantAuthentication({ auth, authenticationMode: settings.authenticationMode, id, participants })
  }

  return settings.isFeedbackChannelActive
    ? sortBy(
        (o) => -dayjs(o.resolvedAt).unix(),
        feedbacks.filter((feedback) => feedback.published)
      )
    : []
}

/**
 * Resets question instances
 */
async function resetQuestionInstances({ instanceIds }) {
  return Promise.all(
    instanceIds.map(async (instanceId) => {
      // reset any data that has been persisted to the database
      await QuestionInstanceModel.findByIdAndUpdate(instanceId, {
        responses: [],
        dropped: [],
        blockedParticipants: [],
        results: null,
      })

      const instanceKey = `instance:${instanceId}`
      const isInstanceActive = await responseCache.exists(`${instanceKey}:info`)

      // if there is an instance in the cache (i.e., the block is currently active)
      if (isInstanceActive) {
        // get metadata from the redis cache
        const type = await responseCache.hget(`${instanceKey}:info`, 'type')

        // remove the participants, responses, and dropped responses from the cache
        await responseCache.del(`${instanceKey}:participants`, `${instanceKey}:responses`, `${instanceKey}:dropped`)

        // await responseCache.sadd(`${instanceKey}:participantList`, ...participants)

        if (type === QUESTION_TYPES.SC || type === QUESTION_TYPES.MC) {
          const choiceKeys = await responseCache.hkeys(`${instanceKey}:results`)
          await Promise.all(choiceKeys.map((key) => responseCache.hset(`${instanceKey}:results`, `${key}`, 0)))
        }

        if (type === QUESTION_TYPES.FREE || type === QUESTION_TYPES.FREE_RANGE) {
          const responseHashes = await responseCache.hgetall(`${instanceKey}:responseHashes`)
          await responseCache.del(`${instanceKey}:responseHashes`)
          await responseCache.hdel(`${instanceKey}:results`, Object.keys(responseHashes))
          await responseCache.hset(`${instanceKey}:results`, 'participants', 0)
        }
      }
    })
  )
}

/**
 * Resets a question block in a running session
 */

async function resetQuestionBlock({ sessionId, blockId }) {
  // get the session passed and ensure it is running
  const session = await getRunningSession(sessionId)
  const user = await UserModel.findById(session.user)

  // find the block requested by id and extract all instance ids
  const blockIndex = session.blocks.findIndex((block) => block.id === blockId)
  const instanceIds = session.blocks[blockIndex].instances
  const participants = session.settings.isParticipantAuthenticationEnabled && session.participants

  // reset the question instances found
  await resetQuestionInstances({ instanceIds, participants })

  // increment the execution counter of the block
  await SessionModel.findByIdAndUpdate(session.id, {
    $inc: {
      [`blocks.${blockIndex}.execution`]: 1,
    },
  })

  // clean the redis cache to deliver updated execution to participants
  await cleanCache(user.shortname)

  await publishSessionUpdate({ sessionId: session.id, activeBlock: session.activeBlock })

  // return the updated session
  return getRunningSession(sessionId)
}

/**
 * Aggregates confusion data into what is really required by the client
 */
const fetchRunningSessionData = async (userId) => {
  const user = await UserModel.findById(userId).populate('runningSession')

  const { runningSession } = user

  const filteredConfusion = runningSession.confusionTS.filter(
    (element) => dayjs().diff(dayjs(element.createdAt), 'minute') <= 10
  )
  let speedRunning = 0
  let difficultyRunning = 0

  speedRunning =
    filteredConfusion.reduce((previousValue, currentValue) => previousValue + (currentValue.speed + 1) * 0.5, 0) /
    filteredConfusion.length
  difficultyRunning =
    filteredConfusion.reduce((previousValue, currentValue) => previousValue + (currentValue.difficulty + 1) * 0.5, 0) /
    filteredConfusion.length

  if (Number.isNaN(speedRunning)) {
    speedRunning = 0.5
  }
  if (Number.isNaN(difficultyRunning)) {
    difficultyRunning = 0.5
  }
  // overwrite confusionTS data sent to user by filtered and aggregated values
  runningSession.confusionValues = { speed: speedRunning, difficulty: difficultyRunning }

  // readd mongoDB id-field and empty confusionTS
  runningSession.id = runningSession._id
  runningSession.blocks.forEach((block) => {
    // eslint-disable-next-line no-param-reassign
    block.id = block._id
  })
  return runningSession
}

module.exports = {
  getRunningSession,
  addResponse,
  deleteResponse,
  addConfusionTS,
  addFeedback,
  deleteFeedback,
  joinSession,
  joinQA,
  resetQuestionBlock,
  loginParticipant,
  pinFeedback,
  resolveFeedback,
  respondToFeedback,
  deleteFeedbackResponse,
  publishFeedback,
  upvoteFeedback,
  reactToFeedbackResponse,
  fetchRunningSessionData,
}

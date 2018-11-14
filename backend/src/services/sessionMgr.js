const mongoose = require('mongoose')
const { ForbiddenError } = require('apollo-server-express')
const _mapValues = require('lodash/mapValues')
const _forOwn = require('lodash/forOwn')

const { ObjectId } = mongoose.Types

const { sendSlackNotification } = require('./notifications')
const { QuestionInstanceModel, SessionModel, UserModel, QuestionModel } = require('../models')
const { getRedis } = require('../redis')
const {
  QUESTION_TYPES,
  QUESTION_GROUPS,
  SESSION_STATUS,
  QUESTION_BLOCK_STATUS,
  SESSION_ACTIONS,
  Errors,
} = require('../constants')
const { logDebug } = require('../lib/utils')

const redisCache = getRedis()
const responseCache = getRedis(3)

/**
 * If redis is in use, unlink the cached /join/:shortname pages
 * @param {*} shortname
 */
const cleanCache = shortname => {
  const key = `/join/${shortname}`

  logDebug(() => console.log(`[redis] Cleaning up SSR cache for ${key}`))

  // return redis.unlink([`${key}:de`, `${key}:en`])
  // TODO: use unlink with redis 4.x
  return redisCache.del([`${key}:de`, `${key}:en`])
}

/**
 * Ensure that the specified session is actually running
 * Then return the session as running
 * @param {*} sessionId
 */
const getRunningSession = async sessionId => {
  const session = await SessionModel.findById(sessionId)

  // if the session is not yet running, throw an error
  if (session.status === SESSION_STATUS.CREATED) {
    throw new ForbiddenError('SESSION_NOT_STARTED')
  }

  // if the session has already finished, throw an error
  if (session.status === SESSION_STATUS.COMPLETED) {
    throw new ForbiddenError('SESSION_FINISHED')
  }

  return session
}

/**
 * Pass through all the question blocks in params
 * Skip any blocks that are empty (erroneous blocks)
 * Create question instances for all questions within
 * @param {*} param0
 */
const mapBlocks = ({ sessionId, questionBlocks, userId }) => {
  // initialize a store for newly created instance models
  let instances = []
  const promises = []

  const blocks = questionBlocks
    .filter(block => block.questions.length > 0)
    .map(block => ({
      instances: block.questions.map(({ question, version }) => {
        // create a new question instance model
        const instance = new QuestionInstanceModel({
          question,
          session: sessionId,
          user: userId,
          version,
        })

        // update the question with the corresponding instances
        promises.push(
          QuestionModel.findByIdAndUpdate(question, {
            $push: { instances: instance.id },
          })
        )

        // append the new question instance to the store
        instances = [...instances, instance]

        // return only the id of the new instance
        return [instance.id]
      }),
    }))

  return {
    blocks,
    instances,
    promises,
  }
}

/**
 * Parse the results hash object as extracted from redis into digestable results
 * @param {*} redisResults
 */
const choicesToResults = redisResults => {
  if (!redisResults) {
    return {
      CHOICES: [],
      totalParticipants: 0,
    }
  }

  // calculate the number of choices available
  const numChoices = Object.keys(redisResults).length - 1

  // hydrate the instance results
  return {
    CHOICES: new Array(numChoices).fill(0).map((_, i) => +redisResults[i]),
    totalParticipants: redisResults.participants,
  }
}

/**
 * Prase the results hash object as extracted from redis into digestable results
 * @param {*} redisResults
 * @param {*} responseHashes
 */
const freeToResults = (redisResults, responseHashes) => {
  if (!redisResults) {
    return {
      FREE: [],
      totalParticipants: 0,
    }
  }

  const results = redisResults

  // extract the total number of participants
  const totalParticipants = results.participants
  delete results.participants

  // hydrate the instance results
  return {
    FREE: _mapValues(results, (val, key) => ({ count: +val, value: responseHashes[key] })),
    totalParticipants,
  }
}

/**
 * Initialize the redis response cache as needed for session execution
 * @param {*} param0
 */
const initializeResponseCache = async ({ id, question, version, results }) => {
  const transaction = responseCache.multi()

  // extract relevant information from the question entity
  const questionVersion = question.versions[version]

  // set the instance status, opening the instance for responses
  transaction.hmset(`instance:${id}:info`, 'status', 'OPEN', 'type', question.type)
  transaction.hset(`instance:${id}:results`, 'participants', results ? results.totalParticipants : 0)

  // include the min/max restrictions in the cache for FREE_RANGE questions
  if (question.type === QUESTION_TYPES.FREE_RANGE && questionVersion.options.FREE_RANGE.restrictions) {
    transaction.hmset(
      `instance:${id}:info`,
      'min',
      questionVersion.options.FREE_RANGE.restrictions.min,
      'max',
      questionVersion.options.FREE_RANGE.restrictions.max
    )
  }

  // initialize results hash for SC and MC questions
  // FREE and FREE_RANGE will be initialized at runtime
  if (QUESTION_GROUPS.CHOICES.includes(question.type)) {
    // extract the options of the question
    const options = questionVersion.options.SC || questionVersion.options.MC

    // initialize all response counts to 0
    options.choices.forEach((_, index) => {
      transaction.hset(`instance:${id}:results`, index, results ? results.CHOICES[index] : 0)
    })
  } else if (results && QUESTION_GROUPS.FREE.includes(question.type)) {
    _forOwn(results.FREE, ({ count, value }, key) => {
      transaction.hset(`instance:${id}:results`, key, count)
      transaction.hset(`instance:${id}:responseHashes`, key, value)
    })
  }

  return transaction.exec()
}

/**
 * Compute the question instance results based on the redis response cache
 * @param {*} param0
 */
const computeInstanceResults = async ({ id, question }) => {
  // setup a transaction for result extraction from redis
  const redisResults = (await responseCache
    .multi()
    .hgetall(`instance:${id}:results`)
    .del(
      `instance:${id}:info`,
      `instance:${id}:results`,
      `instance:${id}:responses`,
      `instance:${id}:ip`,
      `instance:${id}:fp`
    )
    .exec())[0][1]

  if (QUESTION_GROUPS.CHOICES.includes(question.type)) {
    return choicesToResults(redisResults)
  }

  if (QUESTION_GROUPS.FREE.includes(question.type)) {
    // extract the response hashes from redis
    const responseHashes = (await responseCache
      .multi()
      .hgetall(`instance:${id}:responseHashes`)
      .del(`instance:${id}:responseHashes`)
      .exec())[0][1]

    return freeToResults(redisResults, responseHashes)
  }

  return null
}

/**
 * Create a new session
 * @param {*} param0
 */
const createSession = async ({ name, questionBlocks = [], userId }) => {
  const sessionId = ObjectId()
  const { blocks, instances, promises } = mapBlocks({
    sessionId,
    questionBlocks,
    userId,
  })

  // create a new session model
  // pass in the list of blocks created above
  const newSession = new SessionModel({
    _id: sessionId,
    name,
    blocks,
    user: userId,
  })

  // save everything at once
  await Promise.all([
    ...promises,
    ...instances.map(instance => instance.save()),
    newSession.save(),
    UserModel.update(
      { _id: userId },
      {
        $push: { sessions: newSession.id },
      }
    ),
  ])

  return newSession
}

/**
 * Modify a session
 * @param {*} param0
 */
const modifySession = async ({ id, name, questionBlocks, userId }) => {
  // get the specified session from the database
  const sessionWithInstances = await SessionModel.findOne({
    _id: id,
    user: userId,
  }).populate('blocks.instances')
  const session = await SessionModel.findOne({
    _id: id,
    user: userId,
  })

  // ensure the user is authorized to modify this session
  if (!session) {
    throw new ForbiddenError(Errors.UNAUTHORIZED)
  }

  // if the session is anything other than newly created
  // it is not allowed to modify it anymore
  // TODO: allow modifications on blocks that are planned
  if (!session.status === SESSION_STATUS.CREATED) {
    throw new ForbiddenError(Errors.SESSION_ALREADY_STARTED)
  }

  // if the name parameter is set, update the session name
  if (name) {
    session.name = name
  }

  // if the question blocks parameter is set, update the blocks
  if (questionBlocks) {
    // calculate the ids of the old question instances
    const oldInstances = sessionWithInstances.blocks.reduce((acc, block) => [...acc, ...block.instances], [])

    // remove the question instance ids from the corresponding question entities
    const questionCleanup = oldInstances.map(instance =>
      QuestionModel.findByIdAndUpdate(instance.question, {
        $pull: { instances: instance.id },
      })
    )

    // completely remove the instance entities
    const instanceCleanup = QuestionInstanceModel.deleteMany({
      _id: { $in: oldInstances },
    })

    // map the blocks
    const { blocks, instances, promises } = mapBlocks({
      sessionId: id,
      questionBlocks,
      userId,
    })

    // replace the session blocks
    session.blocks = blocks

    // await all promises
    await Promise.all([...promises, instances.map(instance => instance.save()), questionCleanup, instanceCleanup])
  }

  // save the updated session to the database
  await session.save()

  // return the updated session
  return session
}

/**
 * Generic session action handler (start, pause, stop...)
 * @param {*} param0
 * @param {*} actionType
 */
const sessionAction = async ({ sessionId, userId }, actionType) => {
  // get the current user instance
  const user = await UserModel.findById(userId)
  const session = await SessionModel.findById(sessionId)

  // ensure the user is authorized to modify this session
  if (!user || !session || !session.user.equals(userId)) {
    throw new ForbiddenError('UNAUTHORIZED')
  }

  // perform the action specified by the actionType
  switch (actionType) {
    case SESSION_ACTIONS.START:
      // the user can't be running another session to start one
      if (user.runningSession) {
        throw new ForbiddenError('RUNNING_ANOTHER_SESSION')
      }

      // if the session is already running, just return it
      if (session.status === SESSION_STATUS.RUNNING) {
        return session
      }

      // if the session to start was already completed, throw an error
      if (session.status === SESSION_STATUS.COMPLETED) {
        throw new ForbiddenError('SESSION_ALREADY_COMPLETED')
      }

      // if the session is paused, reinitialize the redis cache with persisted results
      if (session.status === SESSION_STATUS.PAUSED && session.activeInstances.length > 0) {
        const promises = session.activeInstances.map(async instanceId => {
          const instance = await QuestionInstanceModel.findById(instanceId).populate('question')

          await initializeResponseCache(instance)
        })

        await Promise.all(promises)
      }

      // update the session status to RUNNING
      // this will also continue the session when it has been paused
      session.status = SESSION_STATUS.RUNNING

      // if the session has not been paused, initialize the startedAt date
      if (session.status !== SESSION_STATUS.PAUSED) {
        session.startedAt = Date.now()
      }

      break

    case SESSION_ACTIONS.PAUSE:
      if (!user.runningSession || session.status !== SESSION_STATUS.RUNNING) {
        throw new ForbiddenError('SESSION_NOT_RUNNING')
      }

      // if the session is already paused, return it
      if (session.status === SESSION_STATUS.PAUSED) {
        return session
      }

      // set the session status to be paused
      session.status = SESSION_STATUS.PAUSED

      // if the session has active instances, persist the results
      if (session.activeInstances.length > 0) {
        const promises = session.activeInstances.map(async instanceId => {
          const instance = await QuestionInstanceModel.findById(instanceId).populate('question')

          // persist the results of the paused instances
          instance.results = await computeInstanceResults(instance)

          return instance.save()
        })

        await Promise.all(promises)
      }

      break

    case SESSION_ACTIONS.STOP:
      // if the session is not yet running, throw an error
      if (session.status === SESSION_STATUS.CREATED) {
        throw new ForbiddenError('SESSION_NOT_STARTED')
      }

      // if the session was already completed, return it
      if (session.status === SESSION_STATUS.COMPLETED) {
        return session
      }

      // update the session status to COMPLETED
      session.status = SESSION_STATUS.COMPLETED

      session.finishedAt = Date.now()

      break

    default:
      throw new ForbiddenError('INVALID_SESSION_ACTION')
  }

  // update the runningSession of the user depending on the action taken
  const updatedUser = UserModel.findByIdAndUpdate(userId, {
    runningSession: actionType === SESSION_ACTIONS.START ? session.id : null,
  })

  const promises = [session.save(), updatedUser]

  // if redis is in use, cleanup the page cache
  if (redisCache) {
    promises.push(cleanCache(user.shortname))
  }

  await Promise.all(promises)

  sendSlackNotification(`[sessions] ${actionType} session at /join/${user.shortname}`)

  return session
}

/**
 * Start an existing session
 * @param {*} param0
 */
const startSession = ({ id, userId, shortname }) =>
  sessionAction({ sessionId: id, userId, shortname }, SESSION_ACTIONS.START)

/**
 * Pause a running session
 * @param {*} param0
 */
const pauseSession = ({ id, userId, shortname }) =>
  sessionAction({ sessionId: id, userId, shortname }, SESSION_ACTIONS.PAUSE)

/**
 * End (complete) an existing session
 * @param {*} param0
 */
const endSession = ({ id, userId, shortname }) =>
  sessionAction({ sessionId: id, userId, shortname }, SESSION_ACTIONS.STOP)

/**
 * Update session settings
 * @param {*} param0
 */
const updateSettings = async ({ sessionId, userId, settings, shortname }) => {
  // TODO: security
  // TODO: ...

  const session = await getRunningSession(sessionId)

  // ensure the user is authorized to modify this session
  if (!session.user.equals(userId)) {
    throw new ForbiddenError('UNAUTHORIZED')
  }

  // merge the existing settings with the new settings
  session.settings = {
    ...session.settings,
    ...settings,
  }

  // if the feedback channel functionality is set to be deactivated
  // automatically unpublish the channel (needs manual reactivation)
  if (settings.isFeedbackChannelActive === false) {
    session.settings.isFeedbackChannelPublic = false
  }

  // if redis is in use, cleanup the page cache
  if (redisCache) {
    await cleanCache(shortname)
  }

  // save the updated session
  await session.save()

  // return the updated session
  return session
}

/**
 * Activate the next question block of a running session
 * @param {*} param0
 */
const activateNextBlock = async ({ userId }) => {
  const user = await UserModel.findById(userId).populate(['activeInstances', 'runningSession'])
  const { shortname, runningSession } = user

  if (!runningSession) {
    throw new ForbiddenError('NO_RUNNING_SESSION')
  }

  // if all the blocks have already been activated, simply return the session
  if (runningSession.activeBlock === runningSession.blocks.length) {
    return user.runningSession
  }

  // prepare an array for promises to be executed
  const promises = []

  const prevBlockIndex = runningSession.activeBlock
  const nextBlockIndex = runningSession.activeBlock + 1

  if (runningSession.activeInstances.length === 0) {
    // if there are no active instances, activate the next block
    runningSession.activeStep += 1

    // increase the index of the currently active block
    runningSession.activeBlock += 1

    // find the next block for the running session
    const nextBlock = runningSession.blocks[nextBlockIndex]

    // update the instances in the new active block to be open
    const instancePromises = nextBlock.instances.map(async instanceId => {
      const instance = await QuestionInstanceModel.findById(instanceId).populate('question')

      // set the instances to be open
      instance.isOpen = true

      // if a response cache is available, hydrate it with the newly activated instances
      if (responseCache) {
        const initResponseCache = initializeResponseCache(instance)
        promises.push(initResponseCache)
      }

      return instance.save()
    })

    // push the update promises to the list of all promises
    promises.push(Promise.all(instancePromises))

    // set the status of the instances in the next block to active
    runningSession.blocks[nextBlockIndex].status = QUESTION_BLOCK_STATUS.ACTIVE

    // set the instances of the next block to be the users active instances
    runningSession.activeInstances = nextBlock.instances
  } else if (runningSession.activeBlock >= 0) {
    // if there are active instances, close them
    runningSession.activeStep += 1

    // find the currently active block
    const previousBlock = runningSession.blocks[prevBlockIndex]

    // update the instances in the currently active block to be closed
    const instancePromises = previousBlock.instances.map(async instanceId => {
      const instance = await QuestionInstanceModel.findById(instanceId).populate('question')

      // set the instances to be open
      instance.isOpen = false

      // compute the instance results based on redis cache contents
      instance.results = await computeInstanceResults(instance)

      return instance.save()
    })

    // push the update promises to the list of all promises
    promises.push(Promise.all(instancePromises))

    // reset the activeInstances of the current session
    runningSession.activeInstances = []

    // set the status of the previous block to executed
    runningSession.blocks[prevBlockIndex].status = QUESTION_BLOCK_STATUS.EXECUTED
  }

  promises.push([runningSession.save(), user.save()])
  await Promise.all(promises)

  // if redis is in use, cleanup the page cache
  if (redisCache) {
    await cleanCache(shortname)
  }

  return user.runningSession
}

/**
 * Delete a session
 * @param {*} param0
 */
const deleteSessions = async ({ userId, ids }) => {
  // get the session from the database
  const sessions = await SessionModel.find({ _id: { $in: ids }, user: userId }).populate('blocks.instances')

  await Promise.all(
    sessions.map(session => {
      // compute the list of question instances used in this session
      const instances = session.blocks.reduce((acc, block) => [...acc, ...block.instances], [])
      const instanceIds = instances.map(instance => instance.id)

      // delete the session and all related question instances
      // remove the session from the user model
      return Promise.all([
        SessionModel.deleteOne({ _id: session.id, user: userId }),
        QuestionInstanceModel.deleteMany({
          _id: { $in: instanceIds },
          user: userId,
        }),
        Promise.all(
          instances.map(instance =>
            QuestionModel.findByIdAndUpdate(instance.question, {
              $pull: { instances: instance.id },
            })
          )
        ),
        UserModel.findByIdAndUpdate(userId, { $pullAll: { sessions: [session.id] } }),
      ])
    })
  )

  return 'DELETION_SUCCESSFUL'
}

module.exports = {
  createSession,
  modifySession,
  startSession,
  endSession,
  updateSettings,
  activateNextBlock,
  getRunningSession,
  pauseSession,
  deleteSessions,
  choicesToResults,
  freeToResults,
}

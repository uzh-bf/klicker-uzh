const mongoose = require('mongoose')

const { ObjectId } = mongoose.Types

const { sendSlackNotification } = require('./notifications')
const {
  QuestionInstanceModel, SessionModel, UserModel, QuestionModel,
} = require('../models')
const { getRedis } = require('../redis')
const { SESSION_STATUS, QUESTION_BLOCK_STATUS, SESSION_ACTIONS } = require('../constants')
const { logDebug } = require('../lib/utils')

const redisCache = getRedis()
const redisControl = getRedis(2)

// if redis is in use, unlink the cached /join/:shortname pages
const cleanCache = (shortname) => {
  const key = `/join/${shortname}`

  logDebug(() => console.log(`[redis] Cleaning up SSR cache for ${key}`))

  // return redis.unlink([`${key}:de`, `${key}:en`])
  // TODO: use unlink with redis 4.x
  return redisCache.del([`${key}:de`, `${key}:en`])
}

const getRunningSession = async (sessionId) => {
  const session = await SessionModel.findById(sessionId)

  // if the session is not yet running, throw an error
  if (session.status === SESSION_STATUS.CREATED) {
    throw new Error('SESSION_NOT_STARTED')
  }

  // if the session has already finished, throw an error
  if (session.status === SESSION_STATUS.COMPLETED) {
    throw new Error('SESSION_FINISHED')
  }

  return session
}

// create a new session
const createSession = async ({ name, questionBlocks = [], userId }) => {
  // initialize a store for newly created instance models
  let instances = []

  const promises = []

  // pass through all the question blocks in params
  // skip any blocks that are empty (erroneous blocks)
  // create question instances for all questions within
  const sessionId = ObjectId()
  const blocks = questionBlocks.filter(block => block.questions.length > 0).map(block => ({
    instances: block.questions.map(({ question, version }) => {
      // create a new question instance model
      const instance = new QuestionInstanceModel({
        question,
        session: sessionId,
        user: userId,
        version,
      })

      // update the question with the corresponding instances
      promises.push(QuestionModel.findByIdAndUpdate(question, {
        $push: { instances: instance.id },
      }))

      // append the new question instance to the store
      instances = [...instances, instance]

      // return only the id of the new instance
      return instance.id
    }),
  }))

  // create a new session model
  // pass in the list of blocks created above
  const newSession = new SessionModel({
    id: sessionId,
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
        $currentDate: { updatedAt: true },
      },
    ),
  ])

  return newSession
}

// generic session action handler (start, pause, stop...)
const sessionAction = async ({ sessionId, userId, shortname }, actionType) => {
  // get the current user instance
  const user = await UserModel.findById(userId)
  const session = await SessionModel.findById(sessionId)

  // ensure the user is authorized to modify this session
  if (!user || !session || !session.user.equals(userId)) {
    throw new Error('UNAUTHORIZED')
  }

  // perform the action specified by the actionType
  switch (actionType) {
    case SESSION_ACTIONS.START:
      // the user can't be running another session to start one
      if (user.runningSession) {
        throw new Error('RUNNING_ANOTHER_SESSION')
      }

      // if the session is already running, just return it
      if (session.status === SESSION_STATUS.RUNNING) {
        return session
      }

      // if the session to start was already completed, throw an error
      if (session.status === SESSION_STATUS.COMPLETED) {
        throw new Error('SESSION_ALREADY_COMPLETED')
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
        throw new Error('SESSION_NOT_RUNNING')
      }

      // if the session is already paused, return it
      if (session.status === SESSION_STATUS.PAUSED) {
        return session
      }

      // set the session status to be paused
      session.status = SESSION_STATUS.PAUSED

      break

    case SESSION_ACTIONS.STOP:
      // if the session is not yet running, throw an error
      if (session.status === SESSION_STATUS.CREATED) {
        throw new Error('SESSION_NOT_STARTED')
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
      throw new Error('INVALID_SESSION_ACTION')
  }

  // update the runningSession of the user depending on the action taken
  const updatedUser = UserModel.findByIdAndUpdate(userId, {
    runningSession: actionType === SESSION_ACTIONS.START ? session.id : null,
    $currentDate: { updatedAt: true },
  })

  const promises = [session.save(), updatedUser]

  // if redis is in use, cleanup the page cache
  if (redisCache) {
    promises.push(cleanCache(shortname))
  }

  await Promise.all(promises)

  sendSlackNotification(`[sessions] ${actionType} session at /join/${shortname}`)

  return session
}

// start an existing session
const startSession = ({ id, userId, shortname }) =>
  sessionAction({ sessionId: id, userId, shortname }, SESSION_ACTIONS.START)

// pause a running session
const pauseSession = ({ id, userId, shortname }) =>
  sessionAction({ sessionId: id, userId, shortname }, SESSION_ACTIONS.PAUSE)

// end (complete) an existing session
const endSession = ({ id, userId, shortname }) =>
  sessionAction({ sessionId: id, userId, shortname }, SESSION_ACTIONS.STOP)

// update session settings
const updateSettings = async ({
  sessionId, userId, settings, shortname,
}) => {
  // TODO: security
  // TODO: ...

  const session = await getRunningSession(sessionId)

  // ensure the user is authorized to modify this session
  if (!session.user.equals(userId)) {
    throw new Error('UNAUTHORIZED')
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

// activate the next question block
const activateNextBlock = async ({ userId, shortname }) => {
  const user = await UserModel.findById(userId).populate(['activeInstances', 'runningSession'])
  const { runningSession } = user

  if (!runningSession) {
    throw new Error('NO_RUNNING_SESSION')
  }

  // if all the blocks have already been activated, simply return the session
  if (runningSession.activeBlock === runningSession.blocks.length) {
    return user.runningSession
  }

  // prepare an array for promises to be executed
  const promises = []

  const prevBlockIndex = runningSession.activeBlock
  const nextBlockIndex = runningSession.activeBlock + 1

  if (nextBlockIndex < runningSession.blocks.length) {
    if (runningSession.activeInstances.length === 0) {
      // if there are no active instances, activate the next block
      runningSession.activeStep += 1

      // increase the index of the currently active block
      runningSession.activeBlock += 1

      // find the next block for the running session
      const nextBlock = runningSession.blocks[nextBlockIndex]

      // update the instances in the new active block to be open
      await QuestionInstanceModel.update({ _id: { $in: nextBlock.instances } }, { isOpen: true }, { multi: true })

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
      await QuestionInstanceModel.update({ _id: { $in: previousBlock.instances } }, { isOpen: false }, { multi: true })

      runningSession.activeInstances = []

      // set the status of the previous block to executed
      runningSession.blocks[prevBlockIndex].status = QUESTION_BLOCK_STATUS.EXECUTED

      // if redis is available, cleanup the instance data from the previous block
      if (redisControl) {
        // calculate the keys to be unlinked
        const keys = previousBlock.instances.reduce(
          (prevKeys, instanceId) => [...prevKeys, `${instanceId}:fp`, `${instanceId}:ip`, `${instanceId}:responses`],
          [],
        )

        logDebug(() => console.log('[redis] Cleaning up participant data for instances:', keys))

        // unlink the keys from the redis store
        // const unlinkKeys = await redis.unlink(keys)
        // TODO: use unlink with redis 4.x
        await redisControl.del(keys)
        // console.log(unlinkKeys)
        // promises.push(unlinkKeys)
      }
    }
  } else {
    // if the final block was reached above, reset the users active instances

    // set the status of the previous block to executed
    runningSession.blocks[prevBlockIndex].status = QUESTION_BLOCK_STATUS.EXECUTED

    runningSession.activeInstances = []
    runningSession.activeStep += 1
  }

  promises.concat([runningSession.save(), user.save()])

  // if redis is in use, cleanup the page cache
  if (redisCache) {
    promises.push(cleanCache(shortname))
  }

  await Promise.all(promises)

  return user.runningSession
}

module.exports = {
  createSession,
  startSession,
  endSession,
  updateSettings,
  activateNextBlock,
  getRunningSession,
  pauseSession,
}

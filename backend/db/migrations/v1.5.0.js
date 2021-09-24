/*
This script serves as a migration for session namespacing and participant authentication
*/

require('dotenv').config()

const Redis = require('ioredis')
const { v4: uuidv4 } = require('uuid')
const mongoose = require('mongoose')
const { difference } = require('ramda')
const { isEmail, normalizeEmail } = require('validator')

const { SESSION_STATUS } = require('../../src/constants')
const { SessionModel, UserModel, QuestionInstanceModel } = require('../../src/models')
const SessionMgrService = require('../../src/services/sessionMgr')

mongoose.Promise = Promise

mongoose.connect(`mongodb://${process.env.MONGO_URL}`, {
  keepAlive: true,
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 1000,
})

const redis = new Redis({ db: 3, family: 4, host: 'localhost' })

async function migrateSession(session) {
  // console.log(`> Migrate ${session.id}`)
  return SessionModel.updateOne(
    { _id: session.id },
    {
      $set: {
        // initialize a namespace for all sessions
        namespace: uuidv4(),

        // set the participant settings for all sessions
        participants: [],
        'settings.isParticipantAuthenticationEnabled': false,
        'settings.authenticationMode': 'NONE',
        'settings.storageMode': 'SECRET',
      },
      $unset: {
        isBeta: '',
        'settings.fingerprinting': '',
        'settings.ipFiltering': '',
      },
    }
  )
}

async function ensureRunningSessionConsistency() {
  const runningSessions = await SessionModel.find({
    status: 'RUNNING',
  })
  const userRunningSessions = await UserModel.find({
    runningSession: {
      $ne: null,
    },
  })

  const runningSessionIds = runningSessions.map((s) => s.id.toString())
  const userRunningSessionIds = userRunningSessions.map((s) => s.runningSession.toString())

  // compute sessions that are running but not in the runningSession of a user
  const diff1 = difference(runningSessionIds, userRunningSessionIds)
  // console.log('status running, but not on a user', diff1)
  await Promise.all(
    diff1.map(async (inconsistentSession) => {
      console.log(`> Setting session.${inconsistentSession}.status to COMPLETED`)
      return SessionModel.updateOne({ _id: inconsistentSession }, { status: 'COMPLETED' })
    })
  )

  // compute sessions that are in the runningSession of users but don't have a running status
  const diff2 = difference(userRunningSessionIds, runningSessionIds)
  // console.log('status not running, but on a user', diff2)
  await Promise.all(
    diff2.map(async (inconsistentUser) => {
      console.log(`> Setting user.${inconsistentUser}.runningSession to null`)
      return UserModel.updateOne({ runningSession: inconsistentUser }, { runningSession: null })
    })
  )
}

async function ensureInstanceSessionConsistency() {
  const users = await UserModel.find({})

  return Promise.all(
    users.map((user) =>
      Promise.all(
        user.sessions.map(async (sessionId) => {
          const session = await SessionModel.findById(sessionId)

          const promises = session.blocks.flatMap((block) =>
            block.instances.map(async (instanceId) => {
              const instance = await QuestionInstanceModel.findById(instanceId)

              if (session.id.toString() !== instance.session.toString()) {
                console.log(`${user.email} - ID mismatch ${session.id} ${instance.session}`)
                instance.session = session.id
                await instance.save()
              }
            })
          )

          return Promise.all(promises)
        })
      )
    )
  )
}

async function ensureOpenInstanceConsistency() {
  const runningSessions = await SessionModel.find({ status: 'RUNNING' }).populate({ path: 'activeInstances' })
  const allActiveInstances = runningSessions.flatMap((session) => session.activeInstances)
  const allActiveInstanceIds = allActiveInstances.map((instance) => instance.id.toString())

  const allOpenInstances = await QuestionInstanceModel.find({ isOpen: true })
  const allOpenInstanceIds = allOpenInstances.map((instance) => instance.id.toString())

  console.log(allActiveInstanceIds.length, allOpenInstanceIds.length)

  const diff1 = difference(allActiveInstanceIds, allOpenInstanceIds)
  const diff2 = difference(allOpenInstanceIds, allActiveInstanceIds)

  console.log(diff1.length, diff2.length)
  // console.log(diff1)
  // console.log(diff2)

  // set all inconsistently open instances to be closed
  await Promise.all(
    diff2.map((inconsistentInstanceId) => {
      console.log(`> Setting instance.${inconsistentInstanceId}.isOpen to false`)
      return QuestionInstanceModel.updateOne({ _id: inconsistentInstanceId }, { isOpen: false })
    })
  )
}

async function normalizeEmails() {
  // extract all users from the database
  const users = await UserModel.find({})

  // go through all users
  // update their email with a normalized version
  return Promise.all(
    users
      .filter((user) => isEmail(user.email))
      .map(async (user) => {
        const { id, email } = user
        const normalizedEmail = normalizeEmail(email)

        if (email !== normalizedEmail) {
          console.log(`${email} -> ${normalizedEmail}`)
          return UserModel.update({ _id: id }, { $set: { email: normalizedEmail } })
        }

        return Promise.resolve()
      })
  )
}

async function pauseSession(sessionId, withResults = false) {
  const session = await SessionModel.findById(sessionId)

  session.status = SESSION_STATUS.PAUSED

  // if the session has active instances, persist the results
  if (session.activeInstances.length > 0) {
    await Promise.all(
      session.activeInstances.map(async (instanceId) => {
        if (withResults) {
          const instance = await QuestionInstanceModel.findById(instanceId)
          instance.isOpen = false
          instance.results = await SessionMgrService.computeInstanceResults(instance)
          return instance.save()
        }

        return QuestionInstanceModel.findByIdAndUpdate(instanceId, {
          isOpen: false,
          results: null,
        })
      })
    )
  }

  return Promise.all([
    session.save(),
    UserModel.findByIdAndUpdate(session.user, {
      runningSession: null,
    }),
  ])
}

async function cleanupRedis() {
  // remove legacy keys
  const fpKeys = await redis.keys('instance:*:fp')
  const ipKeys = await redis.keys('instance:*:ip')
  const responseKeys = await redis.keys('instance:*:responses')
  if (fpKeys.length + ipKeys.length + responseKeys.length > 0) {
    await redis.del(...fpKeys, ...ipKeys, ...responseKeys)
  }

  // get all of the currently open instances from the database
  const openInstances = await QuestionInstanceModel.find({ isOpen: true })
  const openInstanceIds = openInstances.map((instance) => instance.id.toString())
  console.log(openInstanceIds.length)

  // get all of the instances that are currently in redis
  const cachedInstances = await redis.keys('instance:*')
  const cachedInstanceIds = [...new Set(cachedInstances.map((instance) => instance.split(':')[1]))]
  console.log(cachedInstanceIds.length)

  const diff1 = difference(cachedInstanceIds, openInstanceIds)
  const diff2 = difference(openInstanceIds, cachedInstanceIds)
  console.log(diff1.length, diff2.length)

  console.log(diff2)

  await Promise.all(
    diff1.map(async (leftoverInstance) => {
      console.log(`> Removing cache keys for leftover instance ${leftoverInstance}`)
      const keys = await redis.keys(`instance:${leftoverInstance}:*`)
      return redis.del(...keys)
    })
  )

  await Promise.all(
    diff2.map(async (uncachedInstance) => {
      const openInstance = openInstances.filter((instance) => instance.id.toString() === uncachedInstance)[0]
      console.log(`> Setting session ${openInstance.session} for user ${openInstance.user} to paused`)
      await pauseSession(openInstance.session)
    })
  )
}

async function pauseOldSessions() {
  const oldSessions = await SessionModel.find({ status: 'RUNNING', startedAt: { $lt: '2020-01-01' } })
  return Promise.all(
    oldSessions.map(async (session) => {
      console.log(`> Pausing old session ${session.id} for user ${session.user}`)
      return pauseSession(session.id, true)
    })
  )
}

mongoose.connection
  .once('open', async () => {
    await normalizeEmails()

    const sessions = await SessionModel.find({})
    await Promise.all(sessions.map(migrateSession))

    await ensureInstanceSessionConsistency()
    await ensureRunningSessionConsistency()
    await ensureOpenInstanceConsistency()

    await cleanupRedis()

    await ensureOpenInstanceConsistency()

    await pauseOldSessions()

    process.exit(0)
  })
  .on('error', (error) => {
    console.warn('> Warning: ', error)
    process.exit(1)
  })

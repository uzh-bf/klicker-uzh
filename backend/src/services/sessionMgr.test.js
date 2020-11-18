require('dotenv').config()

const mongoose = require('mongoose')

const SessionMgrService = require('./sessionMgr')
const { QuestionInstanceModel, SessionModel, UserModel } = require('../models')
const { initializeDb, prepareSessionFactory } = require('../lib/test/setup')
const { sessionSerializer, questionInstanceSerializer } = require('../lib/test/serializers')
const { getRedis } = require('../redis')
const { SESSION_STATUS, QUESTION_TYPES, QUESTION_BLOCK_STATUS } = require('../constants')

mongoose.Promise = Promise

// define how jest should serialize objects into snapshots
// we need to strip ids and dates as they are always changing
expect.addSnapshotSerializer(sessionSerializer)
expect.addSnapshotSerializer(questionInstanceSerializer)

const prepareSession = prepareSessionFactory(SessionMgrService)

const responseCache = getRedis(3)

describe('SessionMgrService', () => {
  let sessionId
  let sessionIdWithAuth
  let userId
  let questions

  beforeAll(async () => {
    ;({ userId, questions } = await initializeDb({
      mongoose,
      email: 'testsessionmgr@bf.uzh.ch',
      shortname: 'sesMgr',
      withLogin: true,
      withQuestions: true,
    }))
  })
  afterAll(async (done) => {
    userId = undefined
    await mongoose.disconnect(done)
  })

  describe('choicesToResults', () => {
    it('correctly handles inexistent results', () => {
      expect(SessionMgrService.choicesToResults()).toEqual({
        CHOICES: [],
        totalParticipants: 0,
      })
    })

    it('correctly aggregates SC/MC question results', () => {
      const redisResult = {
        0: '1',
        3: '3',
        2: '1',
        1: '4',
        participants: '9',
      }

      expect(SessionMgrService.choicesToResults(redisResult)).toMatchSnapshot()
    })
  })

  describe('freeToResults', () => {
    it('correctly handles inexistent results', () => {
      expect(SessionMgrService.freeToResults()).toEqual({
        FREE: [],
        totalParticipants: 0,
      })
    })

    it('correctly aggregates FREE/FREE_RANGE question results', () => {
      const redisResult = {
        asdasd: 0,
        asddddd: 1,
        asdd: 3,
        participants: 4,
      }

      const responseHashes = {
        asdasd: 'hello world',
        asddddd: 'blabla',
        asdd: 'hehehe',
      }

      expect(SessionMgrService.freeToResults(redisResult, responseHashes)).toMatchSnapshot()
    })
  })

  describe('createSession', () => {
    it('allows creating sessions without question blocks', async () => {
      const newSession = await SessionMgrService.createSession({
        name: 'empty feedback session',
        questionBlocks: [],
        userId,
      })

      expect(newSession.blocks.length).toEqual(0)
      expect(newSession).toMatchSnapshot()
    })

    it('skips over question blocks without questions', async () => {
      const newSession = await SessionMgrService.createSession({
        name: 'session with an empty block',
        questionBlocks: [
          {
            questions: [
              { question: questions[QUESTION_TYPES.SC].id, version: 0 },
              { question: questions[QUESTION_TYPES.MC].id, version: 0 },
            ],
          },
          {
            questions: [],
          },
          {
            questions: [
              { question: questions[QUESTION_TYPES.FREE].id, version: 0 },
              { question: questions[QUESTION_TYPES.FREE_RANGE].id, version: 0 },
            ],
          },
        ],
        userId,
      })

      expect(newSession.blocks.length).toEqual(2)
      expect(newSession).toMatchSnapshot()
    })

    it('allows creating a valid session', async () => {
      const newSession = await SessionMgrService.createSession({
        name: 'hello world',
        questionBlocks: [
          {
            questions: [
              { question: questions[QUESTION_TYPES.SC].id, version: 0 },
              { question: questions[QUESTION_TYPES.MC].id, version: 0 },
            ],
          },
          {
            questions: [
              { question: questions[QUESTION_TYPES.FREE].id, version: 0 },
              { question: questions[QUESTION_TYPES.FREE_RANGE].id, version: 0 },
            ],
          },
        ],
        userId,
      })

      expect(newSession).toMatchSnapshot()

      sessionId = newSession.id
    })
  })

  describe('modifySession', () => {
    // TODO: make use of the session factory

    it('allows modifying a session', async () => {
      const updatedSession = await SessionMgrService.modifySession({
        id: sessionId,
        name: 'modified hello world',
        questionBlocks: [
          {
            questions: [{ question: questions[QUESTION_TYPES.FREE].id, version: 0 }],
          },
          {
            questions: [
              { question: questions[QUESTION_TYPES.MC].id, version: 0 },
              { question: questions[QUESTION_TYPES.FREE_RANGE].id, version: 0 },
              { question: questions[QUESTION_TYPES.SC].id, version: 0 },
            ],
          },
        ],
        userId,
      })

      expect(updatedSession).toMatchSnapshot()
    })
  })

  describe('startSession', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession({ userId })
    })

    it('allows starting a created session', async () => {
      const startedSession = await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })

      expect(startedSession.status).toEqual(SESSION_STATUS.RUNNING)
      expect(startedSession).toMatchSnapshot()
    })

    it('prevents starting an already completed session', async () => {
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })

      expect(
        SessionMgrService.startSession({
          id: preparedSession.id,
          userId,
        })
      ).rejects.toEqual(new Error('SESSION_ALREADY_COMPLETED'))
    })
  })

  describe('pauseSession', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession({ userId })
    })

    it('prevents pausing a created session', async () => {
      expect(
        SessionMgrService.pauseSession({
          id: preparedSession.id,
          userId,
        })
      ).rejects.toEqual(new Error('SESSION_NOT_RUNNING'))
    })

    it('allows pausing a running session and continuing it later', async () => {
      const runningSession = await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })
      expect(runningSession.status).toEqual(SESSION_STATUS.RUNNING)

      const pausedSession = await SessionMgrService.pauseSession({
        id: preparedSession.id,
        userId,
      })
      expect(pausedSession.status).toEqual(SESSION_STATUS.PAUSED)

      const continuedSession = await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })
      expect(continuedSession.status).toEqual(SESSION_STATUS.RUNNING)
    })

    afterAll(async () => {
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })
    })
  })

  describe('cancelSession', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession({ userId })
    })

    it('prevents cancelling a created session', async () => {
      expect(
        SessionMgrService.cancelSession({
          id: preparedSession.id,
          userId,
        })
      ).rejects.toEqual(new Error('SESSION_NOT_STARTED'))
    })

    it('allows cancelling a running session and restarting it', async () => {
      const runningSession = await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })
      expect(runningSession.status).toEqual(SESSION_STATUS.RUNNING)

      const pausedSession = await SessionMgrService.cancelSession({
        id: preparedSession.id,
        userId,
      })
      expect(pausedSession.status).toEqual(SESSION_STATUS.CREATED)

      const continuedSession = await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })
      expect(continuedSession.status).toEqual(SESSION_STATUS.RUNNING)
    })

    it('deletes session progress upon cancellation', async () => {
      const cancelledSession = await SessionMgrService.cancelSession({
        id: preparedSession.id,
        userId,
      })
      expect(cancelledSession.status).toEqual(SESSION_STATUS.CREATED)
      expect(cancelledSession.activeStep).toEqual(0)
      expect(cancelledSession.activeBlock).toEqual(-1)
      expect(cancelledSession.activeInstances.length).toEqual(0)
      for (let i = 0; i < cancelledSession.blocks.length; i += 1) {
        expect(cancelledSession.blocks[i].status).toEqual(QUESTION_BLOCK_STATUS.PLANNED)
      }

      // TODO: ensure that the redis cache has been reset to a pristine state
    })

    afterAll(async () => {
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })
    })
  })

  describe('endSession', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession({ userId })
    })

    it('prevents completing a newly created session', async () => {
      expect(
        SessionMgrService.endSession({
          id: preparedSession.id,
          userId,
        })
      ).rejects.toEqual(new Error('SESSION_NOT_STARTED'))
    })

    it('allows ending a running session', async () => {
      await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })

      const endedSession = await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })

      expect(endedSession.status).toEqual(SESSION_STATUS.COMPLETED)
      expect(endedSession).toMatchSnapshot()

      // TODO: ensure that the session results have been aggregated and stored in the database
      // TODO: ensure that the session has been pruned from the redis cache
    })

    it('returns on an already completed session', async () => {
      const session = await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })

      expect(session).toMatchSnapshot()
    })
  })

  describe('updateSessionSettings', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession({ userId })
      await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })
    })

    it('allows changing each setting separately', async () => {
      // update isConfusionBarometerActive
      const session = await SessionMgrService.updateSettings({
        sessionId: preparedSession.id,
        userId,
        settings: { isConfusionBarometerActive: true },
      })
      expect(session.settings.isConfusionBarometerActive).toBeTruthy()
      expect(session).toMatchSnapshot()

      // update isFeedbackChannelActive
      const session2 = await SessionMgrService.updateSettings({
        sessionId: preparedSession.id,
        userId,
        settings: { isFeedbackChannelActive: true },
      })
      expect(session2.settings.isFeedbackChannelActive).toBeTruthy()
      expect(session2).toMatchSnapshot()

      // update isFeedbackChannelPublic
      const session3 = await SessionMgrService.updateSettings({
        sessionId: preparedSession.id,
        userId,
        settings: { isFeedbackChannelPublic: true },
      })
      expect(session3.settings.isFeedbackChannelPublic).toBeTruthy()
      expect(session3).toMatchSnapshot()

      // update isConfusionBarometerActive
      const session4 = await SessionMgrService.updateSettings({
        sessionId: preparedSession.id,
        userId,
        settings: { isConfusionBarometerActive: false },
      })
      expect(session4.settings.isConfusionBarometerActive).toBeFalsy()
      expect(session4).toMatchSnapshot()

      // update isFeedbackChannelActive
      const session5 = await SessionMgrService.updateSettings({
        sessionId: preparedSession.id,
        userId,
        settings: { isFeedbackChannelActive: false },
      })
      expect(session5.settings.isFeedbackChannelActive).toBeFalsy()
      expect(session5).toMatchSnapshot()
    })

    it('allows changing all settings at once', async () => {
      const session = await SessionMgrService.updateSettings({
        sessionId: preparedSession.id,
        userId,
        settings: {
          isConfusionBarometerActive: false,
          isFeedbackChannelActive: false,
          isFeedbackChannelPublic: false,
        },
      })
      const { isConfusionBarometerActive, isFeedbackChannelActive, isFeedbackChannelPublic } = session.settings
      expect(isConfusionBarometerActive).toBeFalsy()
      expect(isFeedbackChannelActive).toBeFalsy()
      expect(isFeedbackChannelPublic).toBeFalsy()
      expect(session).toMatchSnapshot()
    })

    afterAll(async () => {
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })
    })
  })

  describe('activateNextBlock', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession({ userId })
    })

    it('has a valid initial state', async () => {
      // start a new session
      const session = await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })
      // find all instances that belong to the new session
      const instances = await QuestionInstanceModel.find({
        _id: { $in: session.blocks[0].instances },
      })

      // expect no block to be active yet
      expect(session.activeBlock).toEqual(-1)
      // expect the session to currently not have any active instances
      expect(session.activeInstances).toHaveLength(0)
      // expect matching snapshots
      expect(session).toMatchSnapshot()
      expect(instances).toMatchSnapshot()
    })

    it('allows activating the first question block', async () => {
      // activate the next block of the running session
      const session = await SessionMgrService.activateNextBlock({ userId })
      // find all instances that belong to the current session
      const instances = await QuestionInstanceModel.find({
        _id: { $in: session.blocks[0].instances },
      })

      // expect the first block to be active
      expect(session.activeBlock).toEqual(0)
      expect(session.activeStep).toEqual(1)
      // expect the session to have some active instances
      expect(session.activeInstances.length).toEqual(1)
      // expect matching snapshots
      expect(session).toMatchSnapshot()
      expect(instances).toMatchSnapshot()

      instances.forEach(async ({ id }) => {
        // expect that a redis object for the instance has been created
        const instanceStatus = await responseCache.hget(`instance:${id}:info`, 'status')
        expect(instanceStatus).toEqual('OPEN')
      })
    })

    it('recognizes that the final block has been active', async () => {
      // finish the session
      const session = await SessionMgrService.activateNextBlock({ userId })
      // find all instances that belong to the current session
      const instances = await QuestionInstanceModel.find({
        _id: { $in: session.blocks[0].instances },
      })

      // expect the first block to be active
      expect(session.activeBlock).toEqual(0)
      // expect the session to have no more active instances
      expect(session.activeInstances).toHaveLength(0)
      // expect matching snapshots
      expect(session).toMatchSnapshot()
      expect(instances).toMatchSnapshot()

      // expect that the redis objects have been pruned
      instances.forEach(async ({ id }) => {
        const instanceExists = await responseCache.exists(`instance:${id}:info`)
        expect(instanceExists).toBeFalsy()
      })
    })

    afterAll(async () => {
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })
    })
  })

  describe('activateBlockById', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession({ userId })
    })

    it('allows activating the first question block by id', async () => {
      // activate the next block of the running session
      const session = await SessionMgrService.activateBlockById({
        userId,
        sessionId: preparedSession.id,
        blockId: preparedSession.blocks[0].id,
      })

      // find all instances that belong to the current session
      const instances = await QuestionInstanceModel.find({
        _id: { $in: session.blocks[0].instances },
      })

      // expect the first block to be active
      expect(session.activeBlock).toEqual(0)
      expect(session.activeStep).toEqual(1)
      // expect the session to have some active instances
      // expect(session.activeInstances.map(v => v.toString())).toEqual(session.blocks[0].instances.map(v => v.toString()))
      // expect matching snapshots
      expect(session).toMatchSnapshot()
      expect(instances).toMatchSnapshot()

      instances.forEach(async ({ id }) => {
        // expect that a redis object for the instance has been created
        const instanceStatus = await responseCache.hget(`instance:${id}:info`, 'status')
        expect(instanceStatus).toEqual('OPEN')
      })
    })

    afterAll(async () => {
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })
    })
  })

  describe('deleteSession', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession({ userId })
    })

    it('fully deletes a session and all question instances', async () => {
      expect(preparedSession).toMatchSnapshot()

      // compute the instance ids related to the session
      const instanceIds = preparedSession.blocks.reduce((acc, block) => [...acc, ...block.instances], [])

      // ensure that all the instances are present
      instanceIds.forEach(async (questionInstance) => {
        const matchingInstances = await QuestionInstanceModel.count({
          _id: questionInstance,
        })
        expect(matchingInstances).toEqual(1)
      })

      const userBefore = await UserModel.findById(userId)

      // perform the session deletion
      const result = await SessionMgrService.deleteSessions({
        ids: [preparedSession.id],
        userId,
      })
      expect(result).toEqual('DELETION_SUCCESSFUL')

      // expect the session to have been deleted
      const matchingSessions = await SessionModel.count({
        _id: preparedSession.id,
      })
      expect(matchingSessions).toEqual(0)

      // expect the instances to have been deleted
      instanceIds.forEach(async (questionInstance) => {
        const matchingInstances = await QuestionInstanceModel.count({
          _id: questionInstance,
        })
        expect(matchingInstances).toEqual(0)
      })

      const userAfter = await UserModel.findById(userId)
      expect(userAfter.sessions.length).toEqual(userBefore.sessions.length - 1)
    })
  })

  describe('abortSession', () => {
    let preparedSession
    beforeAll(async () => {
      preparedSession = await prepareSession({ userId })

      // start a new session
      await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })
    })

    it('successfully abort a running session of a user', async () => {
      // perform the session abort
      const abortedSession = await SessionMgrService.abortSession({ id: preparedSession.id })

      expect(abortedSession.status).toEqual(SESSION_STATUS.COMPLETED)
      expect(abortedSession).toMatchSnapshot()

      const userAfter = await UserModel.findById(userId)
      // make sure User's running session was aborted
      expect(userAfter.runningSession).toBeFalsy()
    })
  })

  describe('createSession (auth)', () => {
    it('allows creating a valid session with participant authentication', async () => {
      const newSession = await SessionMgrService.createSession({
        name: 'with authentication',
        participants: [{ username: 'testparticipant' }, { username: 'participant2' }],
        questionBlocks: [
          {
            questions: [
              { question: questions[QUESTION_TYPES.SC].id, version: 0 },
              { question: questions[QUESTION_TYPES.MC].id, version: 0 },
            ],
          },
          {
            questions: [
              { question: questions[QUESTION_TYPES.FREE].id, version: 0 },
              { question: questions[QUESTION_TYPES.FREE_RANGE].id, version: 0 },
            ],
          },
        ],
        userId,
      })

      expect(newSession.participants).toHaveLength(2)
      expect(newSession).toMatchSnapshot()

      sessionIdWithAuth = newSession.id
    })
  })

  describe('modifySession (auth)', () => {
    // TODO: make use of the session factory

    it('allows changing the participants of a session', async () => {
      const updatedSession = await SessionMgrService.modifySession({
        id: sessionIdWithAuth,
        participants: [{ username: 'newparticipant' }],
        userId,
      })

      expect(updatedSession.participants).toHaveLength(1)
      expect(updatedSession).toMatchSnapshot()
    })
  })
})

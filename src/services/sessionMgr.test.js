require('dotenv').config()

const mongoose = require('mongoose')

const SessionMgrService = require('./sessionMgr')
const { QuestionInstanceModel } = require('../models')
const { initializeDb, prepareSessionFactory } = require('../lib/test/setup')
const { sessionSerializer, questionInstanceSerializer } = require('../lib/test/serializers')

const { QuestionTypes } = require('../constants')

mongoose.Promise = Promise

// define how jest should serialize objects into snapshots
// we need to strip ids and dates as they are always changing
expect.addSnapshotSerializer(sessionSerializer)
expect.addSnapshotSerializer(questionInstanceSerializer)

const prepareSession = prepareSessionFactory(SessionMgrService)

describe('SessionMgrService', () => {
  let userId
  let questions

  beforeAll(async () => {
    ({ userId, questions } = await initializeDb({
      mongoose,
      email: 'testSessionMgr@bf.uzh.ch',
      shortname: 'sesMgr',
      withLogin: true,
      withQuestions: true,
    }))
  })
  afterAll((done) => {
    mongoose.disconnect(done)
    userId = undefined
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
              { question: questions[QuestionTypes.SC].id, version: 0 },
              { question: questions[QuestionTypes.MC].id, version: 0 },
            ],
          },
          {
            questions: [],
          },
          {
            questions: [
              { question: questions[QuestionTypes.FREE].id, version: 0 },
              { question: questions[QuestionTypes.FREE_RANGE].id, version: 0 },
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
              { question: questions[QuestionTypes.SC].id, version: 0 },
              { question: questions[QuestionTypes.MC].id, version: 0 },
            ],
          },
          {
            questions: [
              { question: questions[QuestionTypes.FREE].id, version: 0 },
              { question: questions[QuestionTypes.FREE_RANGE].id, version: 0 },
            ],
          },
        ],
        userId,
      })

      expect(newSession).toMatchSnapshot()
    })
  })

  describe('startSession', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession(userId)
    })

    it('allows starting a created session', async () => {
      const startedSession = await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })

      expect(startedSession.status).toEqual(SessionMgrService.SessionStatus.RUNNING)
      expect(startedSession).toMatchSnapshot()
    })

    it('prevents starting an already completed session', async () => {
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })

      expect(SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })).rejects.toEqual(new Error('SESSION_ALREADY_COMPLETED'))
    })
  })

  describe('endSession', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession(userId)
    })

    it('prevents completing a newly created session', async () => {
      expect(SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })).rejects.toEqual(new Error('SESSION_NOT_STARTED'))
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

      expect(endedSession.status).toEqual(SessionMgrService.SessionStatus.COMPLETED)
      expect(endedSession).toMatchSnapshot()
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
      preparedSession = await prepareSession(userId)
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
      preparedSession = await prepareSession(userId)
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
      expect(session.activeInstances.map(v => v.toString())).toEqual(session.blocks[0].instances.map(v => v.toString()))
      // expect matching snapshots
      expect(session).toMatchSnapshot()
      expect(instances).toMatchSnapshot()
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
    })

    afterAll(async () => {
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })
    })
  })
})

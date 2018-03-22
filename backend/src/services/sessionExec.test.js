require('dotenv').config()

const mongoose = require('mongoose')
const md5 = require('md5')

const SessionMgrService = require('./sessionMgr')
const SessionExecService = require('./sessionExec')
const { initializeDb, prepareSessionFactory } = require('../lib/test/setup')
const { sessionSerializer, questionInstanceSerializer } = require('../lib/test/serializers')

const { QuestionTypes } = require('../constants')

mongoose.Promise = Promise

// define how jest should serialize objects into snapshots
// we need to strip ids and dates as they are always changing
expect.addSnapshotSerializer(sessionSerializer)
expect.addSnapshotSerializer(questionInstanceSerializer)

const prepareSession = prepareSessionFactory(SessionMgrService)

describe('SessionExecService', () => {
  let userId
  let questions

  beforeAll(async () => {
    ({ userId, questions } = await initializeDb({
      mongoose,
      email: 'testSessionExec@bf.uzh.ch',
      shortname: 'sesExc',
      withLogin: true,
      withQuestions: true,
    }))
  })
  afterAll((done) => {
    mongoose.disconnect(done)
    userId = undefined
  })

  describe('addFeedback', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession(userId)
    })

    it('prevents adding feedbacks if a session is not yet running', () => {
      expect(SessionExecService.addFeedback({
        sessionId: preparedSession.id,
        content: 'FAIL',
      })).rejects.toEqual(new Error('SESSION_NOT_STARTED'))
    })

    it('prevents adding feedbacks if the functionality is deactivated', async () => {
      await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })

      expect(SessionExecService.addFeedback({
        sessionId: preparedSession.id,
        content: 'FAIL',
      })).rejects.toEqual(new Error('SESSION_FEEDBACKS_DEACTIVATED'))
    })

    it('allows adding new feedbacks to a running session', async () => {
      await SessionMgrService.updateSettings({
        sessionId: preparedSession.id,
        userId,
        settings: {
          isFeedbackChannelActive: true,
        },
      })

      const session = await SessionExecService.addFeedback({
        sessionId: preparedSession.id,
        content: 'feedback1',
      })
      expect(session).toMatchSnapshot()

      const session2 = await SessionExecService.addFeedback({
        sessionId: preparedSession.id,
        content: 'feedback2',
      })
      expect(session2).toMatchSnapshot()
    })

    it('prevents adding feedbacks to an already finished session', async () => {
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })

      // TODO: add assertion
    })

    it('allows the lecturer to delete feedbacks', async () => {
      // TODO: assertions
    })
  })

  describe('addConfusionTS', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession(userId)
    })

    it('prevents adding timesteps if a session is not yet running', () => {
      expect(SessionExecService.addConfusionTS({
        sessionId: preparedSession.id,
        difficulty: 3,
        speed: -4,
      })).rejects.toEqual(new Error('SESSION_NOT_STARTED'))
    })

    it('prevents adding timesteps if the functionality is deactivated', async () => {
      await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })

      expect(SessionExecService.addConfusionTS({
        sessionId: preparedSession.id,
        difficulty: 2,
        speed: -3,
      })).rejects.toEqual(new Error('SESSION_CONFUSION_DEACTIVATED'))
    })

    it('allows adding new timesteps', async () => {
      await SessionMgrService.updateSettings({
        sessionId: preparedSession.id,
        userId,
        settings: {
          isConfusionBarometerActive: true,
        },
      })

      const session = await SessionExecService.addConfusionTS({
        sessionId: preparedSession.id,
        difficulty: -5,
        speed: 5,
      })
      expect(session).toMatchSnapshot()

      const session2 = await SessionExecService.addConfusionTS({
        sessionId: preparedSession.id,
        difficulty: 3,
        speed: -4,
      })
      expect(session2).toMatchSnapshot()
    })

    it('prevents adding timesteps to an already finished session', async () => {
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })

      // TODO: add assertion
    })
  })

  describe('addResponse', () => {
    let preparedSession

    beforeEach(async () => {
      // prepare a session with a SC question
      preparedSession = await prepareSession(
        userId,
        [
          { question: questions[QuestionTypes.SC].id, version: 0 },
          { question: questions[QuestionTypes.MC].id, version: 0 },
          { question: questions[QuestionTypes.FREE].id, version: 0 },
          { question: questions[QuestionTypes.FREE_RANGE].id, version: 0 },
        ],
        true,
      )
    })

    afterEach(async () => {
      // end the session
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })
    })

    it('prevents adding a response to a closed question instance', async () => {
      const promise = SessionExecService.addResponse({
        instanceId: preparedSession.activeInstances[1],
        response: {
          choices: [0],
        },
      })
      expect(promise).rejects.toEqual(new Error('INSTANCE_CLOSED'))
    })

    it('allows adding responses to a SC question', async () => {
      const activeInstance = 0

      // activate the next block of the running session
      // this opens the instances for responses
      const session = await SessionMgrService.activateNextBlock({ userId })
      expect(session).toMatchSnapshot()

      // add a response
      const instanceWithResponse = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          choices: [0],
        },
      })
      expect(instanceWithResponse.toObject().results.CHOICES).toEqual([1, 0, 0])

      const instanceWithResponses = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          choices: [1],
        },
      })
      expect(instanceWithResponses.toObject().results.CHOICES).toEqual([1, 1, 0])
      expect(instanceWithResponses).toMatchSnapshot()

      const instanceWithResponses2 = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          choices: [1],
        },
      })
      expect(instanceWithResponses2.toObject().results.CHOICES).toEqual([1, 2, 0])
      expect(instanceWithResponses2).toMatchSnapshot()

      const tooManyChoices = SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          choices: [0, 1, 2],
        },
      })
      expect(tooManyChoices).rejects.toEqual(new Error('TOO_MANY_CHOICES'))
    })

    it('allows adding responses to an MC question', async () => {
      const activeInstance = 1

      // activate the next block of the running session
      // this opens the instances for responses
      const session = await SessionMgrService.activateNextBlock({ userId })
      expect(session).toMatchSnapshot()

      // add a response
      const instanceWithResponse = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          choices: [0],
        },
      })
      expect(instanceWithResponse.toObject().results.CHOICES).toEqual([1, 0, 0])

      const instanceWithResponses = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          choices: [0, 1, 2],
        },
      })
      expect(instanceWithResponses.toObject().results.CHOICES).toEqual([2, 1, 1])
      expect(instanceWithResponses).toMatchSnapshot()
    })

    it('allows adding responses to a FREE question', async () => {
      const activeInstance = 2

      // activate the next block of the running session
      // this opens the instances for responses
      const session = await SessionMgrService.activateNextBlock({ userId })
      expect(session).toMatchSnapshot()

      // try adding an invalid response
      expect(SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          xyz: 23,
        },
      })).rejects.toEqual(new Error('INVALID_RESPONSE'))

      // add a response
      const instanceWithResponse = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          value: 'SCHWEIZ',
        },
      })
      expect(instanceWithResponse.results.FREE).toMatchSnapshot()

      // add more responses
      await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          value: 'schwiiz...',
        },
      })
      const instanceWithResponses = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          value: 'SCHWEIZ',
        },
      })
      const md1 = md5('SCHWEIZ')
      const md2 = md5('schwiiz...')
      expect(instanceWithResponses.results.FREE).toEqual({
        [md1]: {
          count: 2,
          value: 'SCHWEIZ',
        },
        [md2]: {
          count: 1,
          value: 'schwiiz...',
        },
      })
      expect(instanceWithResponses).toMatchSnapshot()
    })

    it('allows adding responses to a FREE_RANGE question', async () => {
      const activeInstance = 3

      // activate the next block of the running session
      // this opens the instances for responses
      const session = await SessionMgrService.activateNextBlock({ userId })
      expect(session).toMatchSnapshot()

      // try adding an invalid response
      expect(SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          xyz: 'asd',
        },
      })).rejects.toEqual(new Error('INVALID_RESPONSE'))

      // try adding a valua that is out-of-range
      expect(SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          value: 99999,
        },
      })).rejects.toEqual(new Error('RESPONSE_OUT_OF_RANGE'))

      // add a response
      const instanceWithResponse = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          value: 10,
        },
      })
      expect(instanceWithResponse.results.FREE).toMatchSnapshot()

      // add more responses
      await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          value: 14,
        },
      })
      const instanceWithResponses = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          value: 10,
        },
      })
      expect(instanceWithResponses.results.FREE).toMatchSnapshot({
        '25daad3d9e60b45043a70c4ab7d3b1c6': {
          count: 2,
          value: 10,
        },
        '09960d18c947355e0b797d2c266e0825': {
          count: 1,
          value: 14,
        },
      })
      expect(instanceWithResponses).toMatchSnapshot()
    })
  })
})

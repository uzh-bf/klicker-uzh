require('dotenv').config()

const mongoose = require('mongoose')
const md5 = require('md5')

const SessionMgrService = require('./sessionMgr')
const SessionExecService = require('./sessionExec')
const { initializeDb, prepareSessionFactory } = require('../lib/test/setup')
const { sessionSerializer, questionInstanceSerializer } = require('../lib/test/serializers')

mongoose.Promise = Promise

// define how jest should serialize objects into snapshots
// we need to strip ids and dates as they are always changing
expect.addSnapshotSerializer(sessionSerializer)
expect.addSnapshotSerializer(questionInstanceSerializer)

const prepareSession = prepareSessionFactory(SessionMgrService)

describe('SessionExecService', () => {
  let user
  let question1
  let question2
  let questionFREE

  beforeAll(async () => {
    ({
      user, question1, question2, questionFREE,
    } = await initializeDb({
      mongoose,
      email: 'testSessionExec@bf.uzh.ch',
      shortname: 'sesExc',
      withLogin: true,
      withQuestions: true,
    }))
  })
  afterAll((done) => {
    mongoose.disconnect(done)
    user = undefined
  })

  describe('addFeedback', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession(user.id)
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
        userId: user.id,
      })

      expect(SessionExecService.addFeedback({
        sessionId: preparedSession.id,
        content: 'FAIL',
      })).rejects.toEqual(new Error('SESSION_FEEDBACKS_DEACTIVATED'))
    })

    it('allows adding new feedbacks to a running session', async () => {
      await SessionMgrService.updateSettings({
        sessionId: preparedSession.id,
        userId: user.id,
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
        userId: user.id,
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
      preparedSession = await prepareSession(user.id)
    })

    it('prevents adding timesteps if a session is not yet running', () => {
      expect(SessionExecService.addConfusionTS({
        sessionId: preparedSession.id,
        difficulty: 9,
        speed: 15,
      })).rejects.toEqual(new Error('SESSION_NOT_STARTED'))
    })

    it('prevents adding timesteps if the functionality is deactivated', async () => {
      await SessionMgrService.startSession({
        id: preparedSession.id,
        userId: user.id,
      })

      expect(SessionExecService.addConfusionTS({
        sessionId: preparedSession.id,
        difficulty: 9,
        speed: 15,
      })).rejects.toEqual(new Error('SESSION_CONFUSION_DEACTIVATED'))
    })

    it('allows adding new timesteps', async () => {
      await SessionMgrService.updateSettings({
        sessionId: preparedSession.id,
        userId: user.id,
        settings: {
          isConfusionBarometerActive: true,
        },
      })

      const session = await SessionExecService.addConfusionTS({
        sessionId: preparedSession.id,
        difficulty: 20,
        speed: 10,
      })
      expect(session).toMatchSnapshot()

      const session2 = await SessionExecService.addConfusionTS({
        sessionId: preparedSession.id,
        difficulty: 40,
        speed: -10,
      })
      expect(session2).toMatchSnapshot()
    })

    it('prevents adding timesteps to an already finished session', async () => {
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId: user.id,
      })

      // TODO: add assertion
    })
  })

  describe('addResponse', () => {
    const SCresponse1 = {
      choices: [0],
    }
    const SCresponse2 = {
      choices: [0, 1],
    }
    let preparedSession

    beforeEach(async () => {
      // prepare a session with a SC question
      preparedSession = await prepareSession(user.id, [question1.id, question2.id, questionFREE.id], true)
    })

    afterEach(async () => {
      // end the session
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId: user.id,
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

    it('allows adding responses [SC]', async () => {
      // activate the next block of the running session
      // this opens the instances for responses
      const session = await SessionMgrService.activateNextBlock({ userId: user.id })
      expect(session).toMatchSnapshot()

      // add a response
      const instanceWithResponse = await SessionExecService.addResponse({
        instanceId: session.activeInstances[1],
        response: SCresponse1,
      })
      expect(instanceWithResponse.toObject().results.choices).toEqual([1, 0])

      const instanceWithResponses = await SessionExecService.addResponse({
        instanceId: session.activeInstances[1],
        response: SCresponse2,
      })
      expect(instanceWithResponses.toObject().results.choices).toEqual([2, 1])
      expect(instanceWithResponses).toMatchSnapshot()
    })

    it('allows adding responses [FREE:NONE]', async () => {
      // activate the next block of the running session
      // this opens the instances for responses
      const session = await SessionMgrService.activateNextBlock({ userId: user.id })
      expect(session).toMatchSnapshot()

      // try adding an invalid response
      expect(SessionExecService.addResponse({
        instanceId: session.activeInstances[2],
        response: {
          xyz: 23,
        },
      })).rejects.toEqual(new Error('INVALID_RESPONSE'))

      // add a response
      const instanceWithResponse = await SessionExecService.addResponse({
        instanceId: session.activeInstances[2],
        response: {
          value: 'SCHWEIZ',
        },
      })
      expect(instanceWithResponse.results.free).toMatchSnapshot()

      // add more responses
      await SessionExecService.addResponse({
        instanceId: session.activeInstances[2],
        response: {
          value: 'schwiiz...',
        },
      })
      const instanceWithResponses = await SessionExecService.addResponse({
        instanceId: session.activeInstances[2],
        response: {
          value: 'SCHWEIZ',
        },
      })
      const md1 = md5('SCHWEIZ')
      const md2 = md5('schwiiz...')
      expect(instanceWithResponses.results.free).toEqual({
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

    it('allows adding responses [FREE:RANGE]', async () => {
      // activate the next block of the running session
      // this opens the instances for responses
      const session = await SessionMgrService.activateNextBlock({ userId: user.id })
      expect(session).toMatchSnapshot()

      // try adding an invalid response
      expect(SessionExecService.addResponse({
        instanceId: session.activeInstances[0],
        response: {
          xyz: 'asd',
        },
      })).rejects.toEqual(new Error('INVALID_RESPONSE'))

      // try adding a valua that is out-of-range
      expect(SessionExecService.addResponse({
        instanceId: session.activeInstances[0],
        response: {
          value: 99999,
        },
      })).rejects.toEqual(new Error('RESPONSE_OUT_OF_RANGE'))

      // add a response
      const instanceWithResponse = await SessionExecService.addResponse({
        instanceId: session.activeInstances[0],
        response: {
          value: 10,
        },
      })
      expect(instanceWithResponse.results.free).toMatchSnapshot()

      // add more responses
      await SessionExecService.addResponse({
        instanceId: session.activeInstances[0],
        response: {
          value: 14,
        },
      })
      const instanceWithResponses = await SessionExecService.addResponse({
        instanceId: session.activeInstances[0],
        response: {
          value: 10,
        },
      })
      expect(instanceWithResponses.results.free).toEqual({
        10: {
          count: 2,
          value: 10,
        },
        14: {
          count: 1,
          value: 14,
        },
      })
      expect(instanceWithResponses).toMatchSnapshot()
    })
  })
})

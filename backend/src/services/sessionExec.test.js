require('dotenv').config()

const mongoose = require('mongoose')

const SessionMgrService = require('./sessionMgr')
const SessionExecService = require('./sessionExec')
const { initializeDb, prepareSessionFactory } = require('../lib/test/setup')
const { sessionSerializer, questionInstanceSerializer, feedbackSerializer } = require('../lib/test/serializers')

const { QUESTION_TYPES } = require('../constants')

mongoose.Promise = Promise

// define how jest should serialize objects into snapshots
// we need to strip ids and dates as they are always changing
expect.addSnapshotSerializer(sessionSerializer)
expect.addSnapshotSerializer(questionInstanceSerializer)
expect.addSnapshotSerializer(feedbackSerializer)

const prepareSession = prepareSessionFactory(SessionMgrService)

describe('SessionExecService', () => {
  let userId
  let questions

  beforeAll(async () => {
    ;({ userId, questions } = await initializeDb({
      mongoose,
      email: 'testsessionexec@bf.uzh.ch',
      shortname: 'sesExc',
      withLogin: true,
      withQuestions: true,
    }))
  })
  afterAll(async (done) => {
    userId = undefined
    await mongoose.disconnect(done)
  })

  describe('addFeedback', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession({ userId })
    })

    it('prevents adding feedbacks if a session is not yet running', () => {
      expect(
        SessionExecService.addFeedback({
          sessionId: preparedSession.id,
          content: 'FAIL',
        })
      ).rejects.toEqual(new Error('SESSION_NOT_STARTED'))
    })

    it('prevents adding feedbacks if the functionality is deactivated', async () => {
      await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })

      expect(
        SessionExecService.addFeedback({
          sessionId: preparedSession.id,
          content: 'FAIL',
        })
      ).rejects.toEqual(new Error('SESSION_FEEDBACKS_DEACTIVATED'))
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
      expect(session).toBeDefined()

      const session2 = await SessionExecService.addFeedback({
        sessionId: preparedSession.id,
        content: 'feedback2',
      })
      expect(session2).toBeDefined()
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
      preparedSession = await prepareSession({ userId })
    })

    it('prevents adding timesteps if a session is not yet running', () => {
      expect(
        SessionExecService.addConfusionTS({
          sessionId: preparedSession.id,
          difficulty: 3,
          speed: -4,
        })
      ).rejects.toEqual(new Error('SESSION_NOT_STARTED'))
    })

    it('prevents adding timesteps if the functionality is deactivated', async () => {
      await SessionMgrService.startSession({
        id: preparedSession.id,
        userId,
      })

      expect(
        SessionExecService.addConfusionTS({
          sessionId: preparedSession.id,
          difficulty: 2,
          speed: -3,
        })
      ).rejects.toEqual(new Error('SESSION_CONFUSION_DEACTIVATED'))
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
      preparedSession = await prepareSession({
        userId,
        questions: [
          { question: questions[QUESTION_TYPES.SC].id, version: 0 },
          { question: questions[QUESTION_TYPES.MC].id, version: 0 },
          { question: questions[QUESTION_TYPES.FREE].id, version: 0 },
          { question: questions[QUESTION_TYPES.FREE_RANGE].id, version: 0 },
        ],
        started: true,
      })
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
      expect(instanceWithResponse).toEqual([
        [null, 1],
        [null, 1],
        // [null, 1],
      ])

      const instanceWithResponses = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          choices: [1],
        },
      })
      expect(instanceWithResponses).toEqual([
        [null, 1],
        [null, 2],
        // [null, 2],
      ])

      const instanceWithResponses2 = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          choices: [1],
        },
      })
      expect(instanceWithResponses2).toEqual([
        [null, 2],
        [null, 3],
        // [null, 3],
      ])

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
      expect(instanceWithResponse).toEqual([
        [null, 1],
        [null, 1],
        // [null, 1],
      ])

      const instanceWithResponses = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          choices: [0, 1, 2],
        },
      })
      expect(instanceWithResponses).toEqual([
        [null, 2],
        [null, 1],
        [null, 1],
        [null, 2],
        // [null, 2],
      ])
    })

    it('allows adding responses to a FREE question', async () => {
      const activeInstance = 2

      // activate the next block of the running session
      // this opens the instances for responses
      const session = await SessionMgrService.activateNextBlock({ userId })
      expect(session).toMatchSnapshot()

      // try adding an invalid response
      expect(
        SessionExecService.addResponse({
          instanceId: session.activeInstances[activeInstance],
          response: {
            xyz: 23,
          },
        })
      ).rejects.toEqual(new Error('INVALID_RESPONSE'))

      // add a response
      const instanceWithResponse = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          value: 'SCHWEIZ',
        },
      })
      expect(instanceWithResponse).toEqual([
        [null, 1],
        [null, 1],
        [null, 1],
        // [null, 1],
      ])

      // add more responses
      const instanceWithResponses = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          value: 'schwiiz...',
        },
      })
      expect(instanceWithResponses).toEqual([
        [null, 1],
        [null, 1],
        [null, 2],
        // [null, 2],
      ])

      const instanceWithResponses2 = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          value: 'SCHWEIZ',
        },
      })
      expect(instanceWithResponses2).toEqual([
        [null, 2],
        [null, 0],
        [null, 3],
        // [null, 3],
      ])
    })

    it('allows adding responses to a FREE_RANGE question', async () => {
      const activeInstance = 3

      // activate the next block of the running session
      // this opens the instances for responses
      const session = await SessionMgrService.activateNextBlock({ userId })
      expect(session).toMatchSnapshot()

      // try adding an invalid response
      expect(
        SessionExecService.addResponse({
          instanceId: session.activeInstances[activeInstance],
          response: {
            value: 'asd',
          },
        })
      ).rejects.toThrow('INVALID_RESPONSE')
      expect(
        SessionExecService.addResponse({
          instanceId: session.activeInstances[activeInstance],
          response: {
            xyz: 'asd',
          },
        })
      ).rejects.toThrow('INVALID_RESPONSE')

      // try adding a value that is out-of-range
      expect(
        SessionExecService.addResponse({
          instanceId: session.activeInstances[activeInstance],
          response: {
            value: 99999,
          },
        })
      ).rejects.toThrow('RESPONSE_OUT_OF_RANGE')

      // add a response
      const instanceWithResponse = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          value: 10,
        },
      })
      expect(instanceWithResponse).toEqual([
        [null, 1],
        [null, 1],
        [null, 1],
        // [null, 1],
      ])

      // add more responses
      const instanceWithResponses = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          value: 14,
        },
      })
      expect(instanceWithResponses).toEqual([
        [null, 1],
        [null, 1],
        [null, 2],
        // [null, 2],
      ])

      const instanceWithResponses2 = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          value: 10,
        },
      })
      expect(instanceWithResponses2).toEqual([
        [null, 2],
        [null, 0],
        [null, 3],
        // [null, 3],
      ])
    })
  })

  describe('addResponse (auth)', () => {
    let preparedSession

    beforeEach(async () => {
      // prepare a session with a SC question
      preparedSession = await prepareSession({
        userId,
        questions: [
          { question: questions[QUESTION_TYPES.SC].id, version: 0 },
          { question: questions[QUESTION_TYPES.MC].id, version: 0 },
          { question: questions[QUESTION_TYPES.FREE].id, version: 0 },
          { question: questions[QUESTION_TYPES.FREE_RANGE].id, version: 0 },
        ],
        started: true,
        participants: [
          { username: 'testparticipant1' },
          { username: 'participant2' },
          { username: 'aaiparticipant', isAAI: true },
        ],
      })
    })

    afterEach(async () => {
      // end the session
      await SessionMgrService.endSession({
        id: preparedSession.id,
        userId,
      })
    })

    it('does not allow aai participants to login', async () => {
      // activate the next block of the running session
      // this opens the instances for responses
      const session = await SessionMgrService.activateNextBlock({ userId })
      expect(session).toMatchSnapshot()

      expect(
        SessionExecService.loginParticipant({ sessionId: session.id, username: 'aaiparticipant', password: '' })
      ).rejects.toThrow('INVALID_PARTICIPANT_LOGIN')
    })

    it('prevents participants without a login from responding', async () => {
      const activeInstance = 0

      // activate the next block of the running session
      // this opens the instances for responses
      const session = await SessionMgrService.activateNextBlock({ userId })
      expect(session).toMatchSnapshot()

      expect(
        SessionExecService.addResponse({
          instanceId: session.activeInstances[activeInstance],
          response: {
            choices: [0],
          },
        })
      ).rejects.toThrow('MISSING_PARTICIPANT_ID')
    })

    it('prevents unauthorized participants from responding', async () => {
      const activeInstance = 0

      // activate the next block of the running session
      // this opens the instances for responses
      const session = await SessionMgrService.activateNextBlock({ userId })
      expect(session).toMatchSnapshot()

      expect(
        SessionExecService.addResponse({
          instanceId: session.activeInstances[activeInstance],
          response: {
            choices: [1],
          },
          auth: {
            sub: 'participant-unauthorized',
          },
        })
      ).rejects.toThrow('RESPONSE_NOT_ALLOWED')
    })

    it('allows participants with a login to respond exactly once', async () => {
      const activeInstance = 0

      // activate the next block of the running session
      // this opens the instances for responses
      const session = await SessionMgrService.activateNextBlock({ userId })
      expect(session).toMatchSnapshot()

      const instanceWithResponse = await SessionExecService.addResponse({
        instanceId: session.activeInstances[activeInstance],
        response: {
          choices: [0],
        },
        auth: {
          sub: session.participants[0].id,
        },
      })
      expect(instanceWithResponse).toEqual([
        [null, 1],
        [null, 1],
        [null, 1],
        // [null, 1],
      ])

      expect(
        SessionExecService.addResponse({
          instanceId: session.activeInstances[activeInstance],
          response: {
            choices: [1],
          },
          auth: {
            sub: session.participants[0].id,
          },
        })
      ).rejects.toThrow('RESPONSE_NOT_ALLOWED')
    })
  })

  // TODO: testing for the COMPLETE storage mode
})

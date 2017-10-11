require('dotenv').config()

const mongoose = require('mongoose')

const AuthService = require('./auth')
const QuestionService = require('./questions')
const SessionService = require('./sessions')
const { setupTestEnv } = require('../utils/testHelpers')

mongoose.Promise = Promise

// define how jest should serialize objects into snapshots
// we need to strip ids and dates as they are always changing
expect.addSnapshotSerializer({
  test: val => val.id && val.blocks && val.name && val.status >= 0 && val.settings && val.user,
  print: val => `
    Name: ${val.name}
    Status: ${val.status}

    Blocks: [${val.blocks.map(block => `
      Show solutions: ${block.showSolutions}
      Status: ${block.status}
      Time limit: ${block.timeLimit}
      Number of instances: ${block.instances.length}
    `)}]

    ConfusionTS: [${val.confusionTS.map(TS => `
      Difficulty: ${TS.difficulty}
      Speed: ${TS.speed}
    `)}]

    Feedbacks: [${val.feedbacks.map(feedback => `
      Content: ${feedback.content}
      Votes: ${feedback.votes}
    `)}]

    Settings:
      ConfusionActive: ${val.settings.isConfusionBarometerActive}
      FeedbacksActive: ${val.settings.isFeedbackChannelActive}
      FeedbacksPublic: ${val.settings.isFeedbackChannelPublic}
    `,
})

// prepare a new session instance
const prepareSession = userId =>
  SessionService.createSession({
    name: 'testing session',
    questionBlocks: [
      {
        questions: [{ id: '59b1481857f3c34af09a4736' }],
      },
    ],
    userId,
  })

describe('SessionService', () => {
  let user
  let question1
  let question2

  beforeAll(async () => {
    // connect to the database
    await mongoose.connect(`mongodb://${process.env.MONGO_URL}`, {
      keepAlive: true,
      reconnectTries: 10,
      useMongoClient: true,
    })

    await setupTestEnv({ email: 'testSessions@bf.uzh.ch', password: 'somePassword', shortname: 'sessio' })

    // login as a test user
    user = await AuthService.login(null, 'testSessions@bf.uzh.ch', 'somePassword')

    question1 = await QuestionService.createQuestion({
      description: 'a description',
      options: [{ correct: false, name: 'option1' }, { correct: true, name: 'option2' }],
      tags: ['AZA', 'BBB'],
      title: 'first question',
      type: 'SC',
      userId: user.id,
    })
    question2 = await QuestionService.createQuestion({
      description: 'very good',
      options: [{ correct: false, name: 'option1' }, { correct: true, name: 'option2' }],
      tags: ['CDEF'],
      title: 'second question',
      type: 'SC',
      userId: user.id,
    })
  })
  afterAll((done) => {
    mongoose.disconnect(done)
    user = undefined
  })

  describe('createSession', () => {
    it('prevents creating sessions without question blocks', async () => {
      expect(SessionService.createSession({
        name: 'empty session',
        questionBlocks: [],
        userId: user.id,
      })).rejects.toEqual(new Error('EMPTY_SESSION'))
    })

    it('skips over question blocks without questions', async () => {
      const newSession = await SessionService.createSession({
        name: 'session with an empty block',
        questionBlocks: [
          {
            questions: [{ id: question1.id }, { id: question2.id }],
          },
          {
            questions: [],
          },
          {
            questions: [{ id: question1.id }],
          },
        ],
        userId: user.id,
      })

      expect(newSession.blocks.length).toEqual(2)
      expect(newSession).toMatchSnapshot()
    })

    it('allows creating a valid session', async () => {
      const newSession = await SessionService.createSession({
        name: 'hello world',
        questionBlocks: [
          {
            questions: [{ id: question1.id }, { id: question2.id }],
          },
          {
            questions: [{ id: question1.id }],
          },
        ],
        userId: user.id,
      })

      expect(newSession).toMatchSnapshot()
    })
  })

  describe('startSession', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession(user.id)
    })

    it('allows starting a created session', async () => {
      const startedSession = await SessionService.startSession({
        id: preparedSession.id,
        userId: user.id,
      })

      expect(startedSession.status).toEqual(1)
      expect(startedSession).toMatchSnapshot()
    })

    it('prevents starting an already completed session', async () => {
      await SessionService.endSession({
        id: preparedSession.id,
        userId: user.id,
      })

      expect(SessionService.startSession({
        id: preparedSession.id,
        userId: user.id,
      })).rejects.toEqual(new Error('SESSION_ALREADY_COMPLETED'))
    })
  })

  describe('endSession', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession(user.id)
    })

    it('prevents completing a newly created session', async () => {
      expect(SessionService.endSession({
        id: preparedSession.id,
        userId: user.id,
      })).rejects.toEqual(new Error('SESSION_NOT_STARTED'))
    })

    it('allows ending a running session', async () => {
      await SessionService.startSession({
        id: preparedSession.id,
        userId: user.id,
      })

      const endedSession = await SessionService.endSession({
        id: preparedSession.id,
        userId: user.id,
      })

      expect(endedSession.status).toEqual(2)
      expect(endedSession).toMatchSnapshot()
    })

    it('returns on an already completed session', async () => {
      const session = await SessionService.endSession({
        id: preparedSession.id,
        userId: user.id,
      })

      expect(session).toMatchSnapshot()
    })
  })

  describe('addFeedback', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession(user.id)
    })

    it('prevents adding feedbacks if a session is not yet running', () => {
      expect(SessionService.addFeedback({
        sessionId: preparedSession.id,
        content: 'FAIL',
      })).rejects.toEqual(new Error('SESSION_NOT_STARTED'))
    })

    it('prevents adding feedbacks if the functionality is deactivated', async () => {
      await SessionService.startSession({
        id: preparedSession.id,
        userId: user.id,
      })

      expect(SessionService.addFeedback({
        sessionId: preparedSession.id,
        content: 'FAIL',
      })).rejects.toEqual(new Error('SESSION_FEEDBACKS_DEACTIVATED'))
    })

    it('allows adding new feedbacks to a running session', async () => {
      await SessionService.updateSettings({
        sessionId: preparedSession.id,
        userId: user.id,
        settings: {
          isFeedbackChannelActive: true,
        },
      })

      const session = await SessionService.addFeedback({
        sessionId: preparedSession.id,
        content: 'feedback1',
      })
      expect(session).toMatchSnapshot()

      const session2 = await SessionService.addFeedback({
        sessionId: preparedSession.id,
        content: 'feedback2',
      })
      expect(session2).toMatchSnapshot()
    })

    it('prevents adding feedbacks to an already finished session', async () => {
      await SessionService.endSession({
        id: preparedSession.id,
        userId: user.id,
      })

      // TODO: add assertion
    })
  })

  describe('addConfusionTS', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession(user.id)
    })

    it('prevents adding timesteps if a session is not yet running', () => {
      expect(SessionService.addConfusionTS({
        sessionId: preparedSession.id,
        difficulty: 9,
        speed: 15,
      })).rejects.toEqual(new Error('SESSION_NOT_STARTED'))
    })

    it('prevents adding timesteps if the functionality is deactivated', async () => {
      await SessionService.startSession({
        id: preparedSession.id,
        userId: user.id,
      })

      expect(SessionService.addConfusionTS({
        sessionId: preparedSession.id,
        difficulty: 9,
        speed: 15,
      })).rejects.toEqual(new Error('SESSION_CONFUSION_DEACTIVATED'))
    })

    it('allows adding new timesteps', async () => {
      await SessionService.updateSettings({
        sessionId: preparedSession.id,
        userId: user.id,
        settings: {
          isConfusionBarometerActive: true,
        },
      })

      const session = await SessionService.addConfusionTS({
        sessionId: preparedSession.id,
        difficulty: 20,
        speed: 10,
      })
      expect(session).toMatchSnapshot()

      const session2 = await SessionService.addConfusionTS({
        sessionId: preparedSession.id,
        difficulty: 40,
        speed: -10,
      })
      expect(session2).toMatchSnapshot()
    })

    it('prevents adding timesteps to an already finished session', async () => {
      await SessionService.endSession({
        id: preparedSession.id,
        userId: user.id,
      })

      // TODO: add assertion
    })
  })

  describe('updateSessionSettings', () => {
    let preparedSession

    beforeAll(async () => {
      preparedSession = await prepareSession(user.id)
      await SessionService.startSession({
        id: preparedSession.id,
        userId: user.id,
      })
    })

    it('allows changing each setting seperately', async () => {
      // update isConfusionBarometerActive
      const session = await SessionService.updateSettings({
        sessionId: preparedSession.id,
        userId: user.id,
        settings: { isConfusionBarometerActive: true },
      })
      expect(session.settings.isConfusionBarometerActive).toBeTruthy()
      expect(session).toMatchSnapshot()

      // update isFeedbackChannelActive
      const session2 = await SessionService.updateSettings({
        sessionId: preparedSession.id,
        userId: user.id,
        settings: { isFeedbackChannelActive: true },
      })
      expect(session2.settings.isFeedbackChannelActive).toBeTruthy()
      expect(session2).toMatchSnapshot()

      // update isFeedbackChannelPublic
      const session3 = await SessionService.updateSettings({
        sessionId: preparedSession.id,
        userId: user.id,
        settings: { isFeedbackChannelPublic: true },
      })
      expect(session3.settings.isFeedbackChannelPublic).toBeTruthy()
      expect(session3).toMatchSnapshot()

      // update isConfusionBarometerActive
      const session4 = await SessionService.updateSettings({
        sessionId: preparedSession.id,
        userId: user.id,
        settings: { isConfusionBarometerActive: false },
      })
      expect(session4.settings.isConfusionBarometerActive).toBeFalsy()
      expect(session4).toMatchSnapshot()

      // update isFeedbackChannelActive
      const session5 = await SessionService.updateSettings({
        sessionId: preparedSession.id,
        userId: user.id,
        settings: { isFeedbackChannelActive: false },
      })
      expect(session5.settings.isFeedbackChannelActive).toBeFalsy()
      expect(session5).toMatchSnapshot()
    })

    it('allows changing all settings at once', async () => {
      const session = await SessionService.updateSettings({
        sessionId: preparedSession.id,
        userId: user.id,
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
      await SessionService.stopSession({
        id: preparedSession.id,
        userId: user.id,
      })
    })
  })
})

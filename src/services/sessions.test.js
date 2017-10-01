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

    Blocks: ${val.blocks.map(block => `
      Show solutions: ${block.showSolutions}
      Status: ${block.status}
      Time limit: ${block.timeLimit}
      Number of instances: ${block.questions.length}
    `)}

    Settings:
      ${val.settings}
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
      tags: ['AZA', 'BBB'],
      title: 'first question',
      type: 'SC',
      userId: user.id,
    })
    question2 = await QuestionService.createQuestion({
      description: 'very good',
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
})

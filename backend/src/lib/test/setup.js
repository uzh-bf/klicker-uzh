const { QuestionModel, QuestionInstanceModel, SessionModel, TagModel, UserModel, FileModel } = require('../../models')
const AccountService = require('../../services/accounts')
const QuestionService = require('../../services/questions')
const { createContentState } = require('../draft')
const { QUESTION_TYPES, ROLES } = require('../../constants')

/**
 * Cleanup all data belonging to a user
 * @param {*} user The id of the user
 */
const cleanupUser = async ({ email, userId }) => {
  if (userId) {
    await Promise.all([
      QuestionInstanceModel.remove({ user: userId }),
      SessionModel.remove({ user: userId }),
      QuestionModel.remove({ user: userId }),
      TagModel.remove({ user: userId }),
      FileModel.remove({ user: userId }),
      UserModel.findByIdAndRemove(userId),
    ])
  } else {
    const user = await UserModel.findOne({ email })
    await Promise.all([
      QuestionInstanceModel.remove({ user: user.id }),
      SessionModel.remove({ user: user.id }),
      QuestionModel.remove({ user: user.id }),
      TagModel.remove({ user: user.id }),
      FileModel.remove({ user: user.id }),
      UserModel.findByIdAndRemove(user.id),
    ])
  }
}

const setupTestEnv = async ({ email, password, shortname, isActive = true, role = ROLES.USER }) => {
  // find the id of the user to reset
  const user = await UserModel.findOne({ email })

  // if the user already exists, delete everything associated
  if (user) {
    await cleanupUser({ userId: user.id })
  }

  // sign up a fresh user
  return AccountService.signup(email, password, shortname, 'IBF Test', 'Testing', role, { isActive })
}

// prepare a new session instance
const prepareSessionFactory =
  (SessionMgrService) =>
  async ({ userId, questions, started = false, participants = [] }) => {
    let session

    if (!questions) {
      const question = await QuestionService.createQuestion({
        content: createContentState('test question'),
        options: {
          choices: [
            { correct: false, name: 'option1' },
            { correct: true, name: 'option2' },
            { correct: false, name: 'option3' },
          ],
          randomized: true,
        },
        tags: ['TEST'],
        title: 'test question',
        type: QUESTION_TYPES.SC,
        userId,
      })

      session = await SessionMgrService.createSession({
        name: 'testing session',
        questionBlocks: [{ questions: [{ question: question.id, version: 0 }] }],
        participants,
        userId,
      })
    } else {
      session = await SessionMgrService.createSession({
        name: 'testing session',
        questionBlocks: [{ questions }],
        participants,
        userId,
      })
    }

    if (started) {
      return SessionMgrService.startSession({
        id: session.id,
        userId,
      })
    }

    return session
  }

const initializeDb = async ({
  mongoose,
  email,
  shortname,
  withLogin = false,
  withQuestions = false,
  isActive = true,
  withAdmin = false,
}) => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(`mongodb://${process.env.MONGO_URL_TEST}`, {
      keepAlive: true,
      promiseLibrary: global.Promise,
      reconnectTries: 10,
    })
  }

  const createdUser = await setupTestEnv({ email, password: 'somePassword', shortname, isActive })
  let createdDummy

  if (withAdmin) {
    // create an admin
    await setupTestEnv({ email: 'admin@bf.uzh.ch', password: 'somePassword', shortname: 'admin', role: ROLES.ADMIN })
    // create another user which is modified and later deleted by the admin in the intregration test
    createdDummy = await setupTestEnv({ email: 'dummy@bf.uzh.ch', password: 'somePassword', shortname: 'dummy' })
  }
  if (withLogin) {
    const result = { userId: await AccountService.login(null, email, 'somePassword') }

    if (withQuestions) {
      result.questions = {
        [QUESTION_TYPES.SC]: await QuestionService.createQuestion({
          content: createContentState('very good'),
          options: {
            choices: [
              { correct: false, name: 'option1' },
              { correct: true, name: 'option2' },
              { correct: false, name: 'option3' },
            ],
            randomized: true,
          },
          tags: ['CDEF'],
          title: 'second question',
          type: QUESTION_TYPES.SC,
          userId: result.userId,
        }),
        [QUESTION_TYPES.MC]: await QuestionService.createQuestion({
          content: createContentState('very good'),
          options: {
            choices: [
              { correct: false, name: 'option1' },
              { correct: true, name: 'option2' },
              { correct: true, name: 'option3' },
            ],
            randomized: true,
          },
          tags: ['CDEF'],
          title: 'second question',
          type: QUESTION_TYPES.MC,
          userId: result.userId,
        }),
        [QUESTION_TYPES.FREE]: await QuestionService.createQuestion({
          content: createContentState('a description'),
          options: {},
          tags: ['AZA', 'BBB'],
          title: 'first question',
          type: QUESTION_TYPES.FREE,
          userId: result.userId,
        }),
        [QUESTION_TYPES.FREE_RANGE]: await QuestionService.createQuestion({
          content: createContentState('a description'),
          options: {
            restrictions: {
              min: 10,
              max: 20,
            },
          },
          tags: ['AZA', 'BBB'],
          title: 'first question',
          type: QUESTION_TYPES.FREE_RANGE,
          userId: result.userId,
        }),
        FREE_RANGE_PART: await QuestionService.createQuestion({
          content: createContentState('a description'),
          options: {
            restrictions: {
              min: 10,
              max: null,
            },
          },
          tags: ['CDEF', 'BBB'],
          title: 'partly restricted free range',
          type: QUESTION_TYPES.FREE_RANGE,
          userId: result.userId,
        }),
        FREE_RANGE_OPEN: await QuestionService.createQuestion({
          content: createContentState('a description'),
          options: {
            restrictions: {
              min: null,
              max: null,
            },
          },
          tags: ['CDEF', 'BBB'],
          title: 'unrestricted free range',
          type: QUESTION_TYPES.FREE_RANGE,
          userId: result.userId,
        }),
      }
    }

    return result
  }

  const dummyId = createdDummy ? createdDummy.id : undefined

  return { userId: createdUser.id, dummyId, email, shortname }
}

module.exports = {
  cleanupUser,
  setupTestEnv,
  prepareSessionFactory,
  initializeDb,
}

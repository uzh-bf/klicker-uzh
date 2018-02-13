const {
  QuestionModel, QuestionInstanceModel, SessionModel, TagModel, UserModel,
} = require('../../models')
const AuthService = require('../../services/auth')
const QuestionService = require('../../services/questions')

const { QuestionTypes } = require('../../constants')

const setupTestEnv = async ({ email, password, shortname }) => {
  // find the id of the user to reset
  const user = await UserModel.findOne({ email })

  // if the user already exists, delete everything associated
  if (user) {
    await Promise.all([
      QuestionInstanceModel.remove({ user: user.id }),
      SessionModel.remove({ user: user.id }),
      QuestionModel.remove({ user: user.id }),
      TagModel.remove({ user: user.id }),
      UserModel.findByIdAndRemove(user.id),
    ])
  }

  // sign up a fresh user
  return AuthService.signup(email, password, shortname)
}

// prepare a new session instance
const prepareSessionFactory = SessionMgrService => async (
  userId,
  questions = [{ question: '59b1481857f3c34af09a4736', version: 0 }],
  started = false,
) => {
  if (started) {
    const session = await SessionMgrService.createSession({
      name: 'testing session',
      questionBlocks: [{ questions }],
      userId,
    })
    return SessionMgrService.startSession({
      id: session.id,
      userId,
    })
  }

  return SessionMgrService.createSession({
    name: 'testing session',
    questionBlocks: [{ questions }],
    userId,
  })
}

const initializeDb = async ({
  mongoose, email, shortname, withLogin = false, withQuestions = false,
}) => {
  await mongoose.connect(`mongodb://${process.env.MONGO_URL}`, {
    keepAlive: true,
    promiseLibrary: global.Promise,
    reconnectTries: 10,
  })

  await setupTestEnv({ email, password: 'somePassword', shortname })

  if (withLogin) {
    const result = {
      user: await AuthService.login(null, email, 'somePassword'),
    }

    if (withQuestions) {
      result.questions = {
        [QuestionTypes.SC]: await QuestionService.createQuestion({
          description: 'very good',
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
          type: QuestionTypes.SC,
          userId: result.user.id,
        }),
        [QuestionTypes.MC]: await QuestionService.createQuestion({
          description: 'very good',
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
          type: QuestionTypes.MC,
          userId: result.user.id,
        }),
        [QuestionTypes.FREE]: await QuestionService.createQuestion({
          description: 'a description',
          options: {},
          tags: ['AZA', 'BBB'],
          title: 'first question',
          type: QuestionTypes.FREE,
          userId: result.user.id,
        }),
        [QuestionTypes.FREE_RANGE]: await QuestionService.createQuestion({
          description: 'a description',
          options: {
            restrictions: {
              min: 10,
              max: 20,
            },
          },
          tags: ['AZA', 'BBB'],
          title: 'first question',
          type: QuestionTypes.FREE_RANGE,
          userId: result.user.id,
        }),
      }
    }

    return result
  }

  return null
}

module.exports = {
  setupTestEnv,
  prepareSessionFactory,
  initializeDb,
}

const {
  QuestionModel, QuestionInstanceModel, SessionModel, TagModel, UserModel,
} = require('../../models')
const AuthService = require('../../services/auth')
const QuestionService = require('../../services/questions')

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
  questions = ['59b1481857f3c34af09a4736'],
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
    reconnectTries: 10,
    useMongoClient: true,
  })

  await setupTestEnv({ email, password: 'somePassword', shortname })

  if (withLogin) {
    const result = {
      user: await AuthService.login(null, email, 'somePassword'),
    }

    if (withQuestions) {
      result.question1 = await QuestionService.createQuestion({
        description: 'a description',
        options: {
          restrictions: {
            min: 10,
            max: 20,
            type: 'RANGE',
          },
        },
        tags: ['AZA', 'BBB'],
        title: 'first question',
        type: 'FREE',
        userId: result.user.id,
      })
      result.question2 = await QuestionService.createQuestion({
        description: 'very good',
        options: {
          choices: [{ correct: false, name: 'option1' }, { correct: true, name: 'option2' }],
          randomized: true,
        },
        tags: ['CDEF'],
        title: 'second question',
        type: 'SC',
        userId: result.user.id,
      })
      result.questionFREE = await QuestionService.createQuestion({
        description: 'a description',
        options: {
          restrictions: {
            min: null,
            max: null,
            type: 'NONE',
          },
        },
        tags: ['AZA', 'BBB'],
        title: 'unrestricted free question',
        type: 'FREE',
        userId: result.user.id,
      })
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

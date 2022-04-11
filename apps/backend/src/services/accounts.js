/* eslint-disable no-await-in-loop */
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const JWT = require('jsonwebtoken')
const _get = require('lodash/get')
const dayjs = require('dayjs')
const passwordGenerator = require('generate-password')
const { isLength, isEmail, normalizeEmail } = require('validator')
const { AuthenticationError, UserInputError } = require('apollo-server-express')
const { v4: uuidv4 } = require('uuid')

const { ObjectId } = mongoose.Types

const CFG = require('../klicker.conf.js')
const validators = require('../lib/validators')
const { QuestionInstanceModel, TagModel, FileModel, SessionModel, QuestionModel, UserModel } = require('../models')
const { sendEmailNotification, sendSlackNotification, compileEmailTemplate } = require('./notifications')
const { Errors, ROLES } = require('../constants')

const APP_CFG = CFG.get('app')

const isDev = process.env.NODE_ENV !== 'production'

// prepare settings for the authentication cookie
// domain: the domain the cookie should be valid for
// httpOnly: don't allow interactions from javascript
// maxAge: one day equals 86400000 milliseconds
// path: cookie should only be valid for the graphql API
// secure: whether the cookie should only be sent over https
// TODO: set other important cookie settings?
const AUTH_COOKIE_SETTINGS = {
  domain: APP_CFG.cookieDomain || APP_CFG.domain,
  httpOnly: true,
  maxAge: 86400000,
  path: APP_CFG.path ? `${APP_CFG.path}/graphql` : '/graphql',
  secure: !isDev && APP_CFG.https,
}

/**
 * Generate JWT contents from a user object and scope
 * @param {Object} user The user to generate for
 * @param {Array} scope The scope of the user
 */
const generateJwtSettings = (user, scope = ['user']) => ({
  // expiresIn: 86400,
  role: user.role,
  sub: user.id,
  scope,
  shortname: user.shortname,
})

/**
 * Check whether a JWT is valid
 * @param {String} jwt The JWT to be verified
 * @param {String} secret The application secret to verify with
 */
const isValidJWT = (jwt, secret) => {
  try {
    JWT.verify(jwt, secret)
    return true
  } catch ({ name }) {
    // if the token is expired, throw
    if (name === 'TokenExpiredError') {
      throw new AuthenticationError('TOKEN_EXPIRED')
    }

    return false
  }
}

/**
 * Extract a JWT from header or cookie
 * @param {Request} req The express request object
 */
const getToken = (req) => {
  // try to parse an authorization cookie
  if (req.cookies && req.cookies.jwt && isValidJWT(req.cookies.jwt, APP_CFG.secret)) {
    return req.cookies.jwt
  }

  // try to parse the authorization header
  if (req.headers.authorization) {
    const split = req.headers.authorization.split(' ')

    if (split[0] === 'Bearer' && isValidJWT(split[1], APP_CFG.secret)) {
      return split[1]
    }
  }

  // if no token was found, but would be needed
  // additionally look for a token in the GraphQL variables (for normal and batch requests)
  const inlineJWT = _get(req, 'body.variables.jwt') || _get(req, 'body[0].variables.jwt')
  if (inlineJWT && isValidJWT(inlineJWT, APP_CFG.secret)) {
    return inlineJWT
  }

  // no token found
  return null
}

/**
 * Generate a token that is scoped for a specific use case
 * @param {*} userId The subject of the new token
 * @param {*} shortname The shortname to be included in the token
 * @param {*} scope The scope the new token should be usable for
 * @param {*} expiresIn The expiration of the new token
 */
const generateScopedToken = (user, scope, expiresIn = '1w') =>
  JWT.sign(generateJwtSettings(user, [scope]), APP_CFG.secret, {
    algorithm: 'HS256',
    expiresIn,
  })

/**
 * Check the availability of fields with uniqueness constraints
 * @param {String} email
 * @param {String} shortname
 */
const checkAvailability = async ({ email, shortname }) => {
  const result = {}

  try {
    if (email) {
      validators.email.check(email)
      result.email = (await UserModel.countDocuments({ email })) === 0
    }

    if (shortname) {
      validators.shortname.check(shortname)
      result.shortname = (await UserModel.countDocuments({ shortname })) === 0
    }
  } catch (e) {
    throw new UserInputError(Errors.INVALID_INPUT)
  }

  return result
}

const DEMO_QUESTIONS = [
  {
    title: 'Demoquestion SC',
    type: 'SC',
    content: 'Which of the following statements is applicable to _KlickerUZH_?',
    options: {
      SC: {
        randomized: false,
        choices: [
          { correct: true, name: 'KlickerUZH is an open-source audience response system' },
          { correct: false, name: 'KlickerUZH is owned by Google' },
          { correct: false, name: 'KlickerUZH cannot be used by everyone' },
          { correct: false, name: 'KlickerUZH is not a project of the University of Zurich' },
        ],
      },
    },
  },
  {
    title: 'Demoquestion MC',
    type: 'MC',
    content:
      'Which of the following formulas have the form of a Taylor polynomial of some degree $$n$$: $$T_n f(x;a)$$? (multiple answers are possible)',
    options: {
      MC: {
        randomized: false,
        choices: [
          { correct: false, name: '$$T_n f(x;a) = \\sum_{|\\alpha| = 0}^{n} (x - a)^\\alpha D^\\alpha f(a-x)$$' },
          {
            correct: true,
            name: "$$T_n f(x;a) = f(a) + \\frac{f'(a)}{1!}(x - a) + \\frac{f''(a)}{2!}(x - a)^2 + ... + \\frac{f^{(n)}(a)}{n!}(x - a)^n$$",
          },
          { correct: true, name: '$$T_4 sin(x;0) = x - \\frac{x^3}{6}$$' },
          { correct: false, name: '$$T_4 cos(x;0) = x + \\frac{x^3}{6}$$' },
        ],
      },
    },
  },
  {
    title: 'Demoquestion FT',
    type: 'FREE',
    content: 'Describe a main principle of a social market economy.',
    options: false,
  },
  {
    title: 'Demoquestion NR',
    type: 'FREE_RANGE',
    content: 'Estimate the length of the **longest** river in the world (answer in kilometres).',
    options: {
      FREE_RANGE: {
        restrictions: { min: 0, max: 8000 },
      },
    },
  },
]

function prepareDemoSessionData({ id, name, user, blockInstances, blockStatus = 'PLANNED', ...rest }) {
  return new SessionModel({
    status: 'CREATED',
    execution: 0,
    activeBlock: -1,
    activeStep: 0,
    participants: [],
    confusionTS: [],
    feedbacks: [],
    ...rest,
    _id: id,
    settings: {
      isParticipantAuthenticationEnabled: false,
      isConfusionBarometerActive: true,
      isEvaluationPublic: false,
      isFeedbackChannelActive: true,
      isFeedbackChannelPublic: true,
      authenticationMode: 'NONE',
      storageMode: 'SECRET',
    },
    namespace: uuidv4(),
    name,
    blocks: blockInstances.map((instances) => ({
      execution: 1,
      status: blockStatus,
      timeLimit: -1,
      randomSelection: -1,
      showSolutions: false,
      instances,
    })),
    activeInstances: [],
    user,
  })
}

async function hydrateDemoData({ userId }) {
  const user = await UserModel.findById(userId)

  // create demo tag
  const demoTag = await new TagModel({
    name: 'DEMO',
    questions: [],
    user: userId,
  }).save()
  user.tags.push(demoTag.id)

  // create demo questions with demo tag from demo data above
  const demoQuestions = await Promise.all(
    DEMO_QUESTIONS.map(async ({ title, type, content, options }) => {
      const newQuestion = await new QuestionModel({
        tags: [demoTag.id],
        title,
        type,
        user: userId,
        versions: [
          {
            content,
            description: content
              .replace(/(\${2})[^]*?[^\\]\1/gm, '$FORMULA$')
              .replaceAll('<br>', '')
              .match(/[\p{L}\p{N}\p{P}\p{M}\s]|[$Formula$]|[(0-9)+. ]|[- ]/gu)
              .join(''),
            options,
            files: [],
            solution: undefined,
          },
        ],
      }).save()

      demoTag.questions.push(newQuestion.id)
      user.questions.push(newQuestion.id)

      return newQuestion
    })
  )

  await Promise.all([user.save(), demoTag.save()])

  // create instances for session population
  const sessionId1 = ObjectId()

  // prepare 8 question instances for the session without results (in pairs of two)
  const questionInstances = await demoQuestions.reduce(async (acc, question) => {
    const instances = await Promise.all(
      [question, question].map(async (questionData) => {
        const newInstance = new QuestionInstanceModel({
          question: questionData.id,
          session: sessionId1,
          user: userId,
          version: 0,
          results: null,
        })
        return newInstance.save()
      })
    )
    const instanceIds = instances.map((instance) => instance.id)
    question.instances.push(...instanceIds)
    await question.save()
    return [...(await acc), ...instanceIds]
  }, Promise.resolve([]))

  // create demo session without results
  const demoSession = prepareDemoSessionData({
    id: sessionId1,
    user: userId,
    name: 'Demosession',
    blockInstances: [
      [questionInstances[0]],
      [questionInstances[4]],
      [questionInstances[2], questionInstances[6]],
      [questionInstances[1], questionInstances[3], questionInstances[5], questionInstances[7]],
    ],
  })
  await demoSession.save()

  const sessionId2 = ObjectId()

  const aggrValuesNR = Array.from({ length: 40 }, () => Math.floor(Math.random() * 1500) + 6500)
    .concat(Array.from({ length: 185 }, () => Math.floor(Math.random() * 250) + 6693))
    .reduce((obj, b) => {
      // eslint-disable-next-line no-param-reassign
      obj[b] = obj[b] + 1 || 1
      return obj
    }, {})
  const NRObject = Object.keys(aggrValuesNR).reduce((a, v) => ({ ...a, [v]: { value: v, count: aggrValuesNR[v] } }), {})

  const instancesWithResults = await Promise.all([
    new QuestionInstanceModel({
      question: demoQuestions[0],
      session: sessionId2,
      user: userId,
      version: 0,
      results: {
        CHOICES: [107, 16, 19, 20],
        totalParticipants: 162,
      },
    }).save(),
    new QuestionInstanceModel({
      question: demoQuestions[1],
      session: sessionId2,
      user: userId,
      version: 0,
      results: {
        CHOICES: [17, 56, 61, 18],
        totalParticipants: 152,
      },
    }).save(),
    new QuestionInstanceModel({
      question: demoQuestions[2],
      session: sessionId2,
      user: userId,
      version: 0,
      results: {
        totalParticipants: 3,
        FREE: {
          hashValue1: {
            count: 1,
            value:
              'This system produces the highest level of economic benefit and social justice for all participants.',
          },
          hashValue2: {
            count: 1,
            value:
              'The system is based on free-market capitalism, but also includes special provisions for social programs, etc.',
          },
          hashValue3: {
            count: 1,
            value: 'The free social market economy is the most common system in the modern world.',
          },
        },
      },
    }).save(),
    new QuestionInstanceModel({
      question: demoQuestions[3],
      session: sessionId2,
      user: userId,
      version: 0,
      results: {
        totalParticipants: 225,
        FREE: NRObject,
      },
    }).save(),
  ])

  const confusionValues = Array(120)
    .fill(0)
    .map((t, index) => {
      return {
        speed: Math.floor(Math.random() * 5) - 2,
        difficulty: Math.floor(Math.random() * 5) - 2,
        createdAt: dayjs()
          .add(index * 40, 'seconds')
          .toDate(),
      }
    })

  const feedbacks = [
    {
      published: true,
      pinned: false,
      resolved: true,
      votes: 13,
      content: 'Which answer was correct for the question about the longest river in the world?',
      responses: [
        {
          positiveReactions: 10,
          negativeReactions: 1,
          content: "The Nile river is the longest in the world with a length of 6'693 kilometres.",
        },
      ],
      resolvedAt: Date.now(),
    },
    {
      published: true,
      pinned: false,
      resolved: false,
      votes: 7,
      content: 'Could you please explain again what the main principles of a social market economy are?',
      responses: [],
    },
    {
      published: true,
      pinned: false,
      resolved: false,
      votes: 4,
      content: 'This example about the fundamental principle of algebra was very helpful, thank you.',
      responses: [],
    },
  ]

  // create evaluation session with question responses, feedbacks and confusion feedback
  const evaluationSession = prepareDemoSessionData({
    id: sessionId2,
    name: 'Demosession with results',
    status: 'COMPLETED',
    user: userId,
    blockInstances: [
      [instancesWithResults[0].id],
      [instancesWithResults[1].id],
      [instancesWithResults[2].id, instancesWithResults[3].id],
    ],
    blockStatus: 'EXECUTED',
    feedbacks,
    confusionTS: confusionValues,
    startedAt: Date.now(),
    finishedAt: Date.now(),
    activeBlock: 2,
    activeStep: 6,
  })
  await evaluationSession.save()

  await UserModel.findByIdAndUpdate(userId, {
    $push: { sessions: [evaluationSession.id, demoSession.id] },
  })
}

/**
 * Register an account for a new user
 * @param {String} email The email of the new user
 * @param {String} password The password of the new user
 * @param {String} shortname The shortname of the new user
 * @param {String} institution  The institution of the new user
 * @param {String} useCase The use case given by the new user
 * @param {Boolean} isAAI Whether the user registrations is performed via AAI
 * @param {Boolean} isActive Whether the user is initially active
 */
const signup = async (
  email,
  password,
  shortname,
  institution,
  useCase,
  role = ROLES.USER,
  { isAAI, isActive } = {}
) => {
  if (!isEmail(email)) {
    throw new UserInputError(Errors.INVALID_EMAIL)
  }

  if (!isLength(password, { min: 8 })) {
    throw new UserInputError(Errors.INVALID_PASSWORD)
  }

  // normalize the email address
  const normalizedEmail = normalizeEmail(email)

  // check for the availability of the normalized email and the chosen shortname
  // throw an error if a matching account already exists
  const availability = await checkAvailability({ email: normalizedEmail, shortname })
  if (availability.email === false) {
    throw new UserInputError(Errors.EMAIL_NOT_AVAILABLE)
  }
  if (availability.shortname === false) {
    throw new UserInputError(Errors.SHORTNAME_NOT_AVAILABLE)
  }

  // generate a salt with bcrypt using 10 rounds
  // hash and salt the password
  const hash = bcrypt.hashSync(password, 10)

  // create a new user based on the passed data
  const newUser = await new UserModel({
    email: normalizedEmail,
    password: hash,
    shortname,
    institution,
    useCase,
    isAAI,
    isActive,
    role,
  }).save()

  if (newUser) {
    // send a slack notification (if configured)
    sendSlackNotification(
      'accounts',
      `New user has registered: ${normalizedEmail}, ${shortname}, ${institution}, ${useCase || '-'}, ${isAAI}`
    )

    if (!isActive) {
      // generate a token scoped for user account activation
      const jwt = generateScopedToken(newUser, 'activate')

      // load the template source and compile it
      const html = compileEmailTemplate('accountActivation', {
        email: normalizedEmail,
        jwt,
      })

      // send an account activation email
      try {
        sendEmailNotification({
          html,
          subject: 'Klicker UZH - Account Activation',
          to: normalizedEmail,
        })
      } catch (e) {
        sendSlackNotification('accounts', `Activation email could not be sent to ${normalizedEmail}`)
      }

      try {
        await hydrateDemoData({ userId: newUser._id })
      } catch (e) {
        sendSlackNotification('accounts', `Demo data hydration failed for ${normalizedEmail} ${e.message}`)
      }

      // return the data of the newly created user
      return newUser
    }
  }

  throw new UserInputError('SIGNUP_FAILED')
}

async function checkAccountStatus({ res, auth }) {
  if (!auth || !auth.sub) {
    return null
  }

  let user
  try {
    user = await UserModel.findOne({ email: auth.sub })
    if (!user) {
      user = await UserModel.findById(auth.sub)
    }
  } catch (e) {
    console.log(e.message)
  }

  if (!user) {
    const shortname = passwordGenerator.generate({ length: 6, uppercase: false, symbols: false, numbers: true })
    const password = passwordGenerator.generate({ length: 20, uppercase: true, symbols: true, numbers: true })
    user = await signup(auth.sub, password, shortname, auth.org, '-', ROLES.USER, { isAAI: true, isActive: true })
  }

  // generate a JWT for future authentication
  const jwt = generateScopedToken(user, 'user')

  // set a cookie with the generated JWT
  if (res && res.cookie) {
    res.cookie('jwt', jwt, AUTH_COOKIE_SETTINGS)
  }

  // update the last login date
  await UserModel.findByIdAndUpdate(user.id, { $currentDate: { lastLoginAt: true } })

  return user.id
}

/**
 * Update personal account data
 * @param {ID} userId
 * @param {String} email
 * @param {String} shortname
 * @param {String} institution
 * @param {String} useCase
 */
const updateAccountData = async ({ userId, email, shortname, institution, useCase, role, caller = ROLES.USER }) => {
  let user
  try {
    user = await UserModel.findById(userId)
  } catch (e) {
    throw new UserInputError(Errors.INVALID_USER)
  }

  if (!user) {
    throw new UserInputError(Errors.INVALID_USER)
  }

  if (email || shortname) {
    const availability = await checkAvailability({ email, shortname })

    if (email) {
      if (user.email !== email && availability.email === false) {
        throw new UserInputError(Errors.EMAIL_NOT_AVAILABLE)
      }

      // caller param can be removed after migration (when users can also edit their email)
      if (caller) {
        user.email = email
      }
    }

    if (shortname) {
      if (user.shortname !== shortname && availability.shortname === false) {
        throw new UserInputError(Errors.SHORTNAME_NOT_AVAILABLE)
      }

      user.shortname = shortname
    }
  }

  try {
    if (institution) {
      validators.institution.check(institution)
      user.institution = institution
    }

    if (useCase) {
      validators.useCase.check(useCase)
      user.useCase = useCase
    }

    if (role) {
      validators.role.check(role)
      user.role = role
    }
  } catch (e) {
    throw new UserInputError(Errors.INVALID_INPUT)
  }

  return user.save()
}

/**
 * Activate a newly created user account
 * @param {String} email The email of the account that should be activated
 * @param {String} activationToken The activation token to be verified
 */
const activateAccount = async (activationToken) => {
  // extract the userId of the account
  const { sub } = JWT.decode(activationToken)

  // activate the user account
  await UserModel.findByIdAndUpdate(sub, {
    isActive: true,
  })

  return 'ACCOUNT_ACTIVATED'
}

/**
 * Login an existing user
 * @param {Response} res The express response object
 * @param {String} email The email of the existing user
 * @param {String} password The password of the existing user
 */
const login = async (res, email, password) => {
  if (!isEmail(email)) {
    throw new UserInputError(Errors.INVALID_EMAIL)
  }

  // normalize the email address
  const normalizedEmail = normalizeEmail(email)

  // look for a single user with the given email
  const user = await UserModel.findOne({
    email: normalizedEmail,
  })

  const invalidLogin = () => {
    sendSlackNotification('accounts', `Login failed for ${email}`)
    throw new AuthenticationError(Errors.INVALID_LOGIN)
  }

  // check whether the user exists
  if (!user) {
    invalidLogin()
  }

  // check whether the account is already active
  if (!user.isActive) {
    throw new AuthenticationError(Errors.ACCOUNT_NOT_ACTIVATED)
  }

  // check if hashed passwords match
  if (!bcrypt.compareSync(password, user.password)) {
    invalidLogin()
  }

  // generate a JWT for future authentication
  // TODO: add more necessary properties for the JWT
  const jwt = JWT.sign(generateJwtSettings(user), APP_CFG.secret, {
    algorithm: 'HS256',
    expiresIn: '1w',
  })

  // set a cookie with the generated JWT
  if (res && res.cookie) {
    res.cookie('jwt', jwt, AUTH_COOKIE_SETTINGS)
  }

  // update the last login date
  await UserModel.findOneAndUpdate({ email: normalizedEmail }, { $currentDate: { lastLoginAt: true } })

  // resolve with data about the user
  return user.id
}

/**
 * Perform logout for a logged in user
 * @param {Response} res The express response object
 */
const logout = async (res) => {
  if (res && res.cookie) {
    res.cookie('jwt', null, {
      ...AUTH_COOKIE_SETTINGS,
      maxAge: -1,
    })
  }
  return 'LOGGED_OUT'
}

/**
 * Update the password of an existing user
 * @param {ID} userId The userId of the corresponding user
 * @param {String} newPassword The new password to be set
 */
const changePassword = async (userId, newPassword) => {
  // look for a user with the given id
  // and check whether the user exists
  const user = await UserModel.findById(userId)
  if (!user) {
    throw new UserInputError('PASSWORD_UPDATE_FAILED')
  }

  // generate a salt with bcyrpt using 10 rounds
  // hash and salt the password
  // set the new password and save the user
  user.password = bcrypt.hashSync(newPassword, 10)
  const updatedUser = await user.save()
  if (!updatedUser) {
    throw new UserInputError('PASSWORD_UPDATE_FAILED')
  }

  // log the password request to slack
  sendSlackNotification('accounts', `Password has been changed for: ${user.email}`)

  // return the updated user
  return updatedUser
}

/**
 * Request a password reset email
 * @param {Response} res The express response object
 * @param {String} email The email to send to
 */
const requestPassword = async (res, email) => {
  if (!isEmail(email)) {
    throw new UserInputError(Errors.INVALID_EMAIL)
  }

  // normalize the email address
  const normalizedEmail = normalizeEmail(email)

  // look for a user with the given email
  // and check whether the user exists
  const user = await UserModel.findOne({ email: normalizedEmail })
  if (!user) {
    return 'PASSWORD_RESET_FAILED'
  }

  // generate a temporary JWT for password reset
  const jwt = JWT.sign(generateJwtSettings(user), APP_CFG.secret, {
    algorithm: 'HS256',
    expiresIn: '1d',
  })

  // load the template source and compile it
  const html = compileEmailTemplate('passwordReset', {
    email: user.email,
    jwt,
  })

  // log the password request to slack
  sendSlackNotification(
    'accounts',
    `Password has been requested for: ${user.email}. Link: https://app.klicker.uzh.ch/user/resetPassword?resetToken=${jwt}`
  )

  // send a password reset email
  try {
    sendEmailNotification({
      html,
      subject: 'Klicker UZH - Password Reset',
      to: user.email,
    })
  } catch (e) {
    return 'PASSWORD_RESET_FAILED'
  }

  return 'PASSWORD_RESET_SENT'
}

/**
 * Request account deletion
 * @param {ID} userId
 */
const requestAccountDeletion = async (userId) => {
  // get the user from the database
  const user = await UserModel.findById(userId)
  if (!user) {
    throw new UserInputError(Errors.INVALID_USER)
  }

  // generate a jwt that is valid for account deletion
  const jwt = generateScopedToken(user, 'delete', '1d')

  // load the template source and compile it
  const html = compileEmailTemplate('deletionRequest', {
    email: user.email,
    jwt,
  })

  // send an account deletion email
  try {
    sendEmailNotification({
      html,
      subject: 'Klicker UZH - Account Deletion Request',
      to: user.email,
    })
  } catch (e) {
    console.log(e)
  }

  // log the account deletion request to slack
  sendSlackNotification('accounts', `Account deletion has been requested for: ${user.email}`)

  return jwt
}

/**
 * Perform all steps needed to fully delete an account
 * @param {*} userId
 */
const performAccountDeletion = async (userId) => {
  // get the user from the database
  const user = await UserModel.findById(userId)
  if (!user) {
    throw new UserInputError(Errors.INVALID_USER)
  }

  sendSlackNotification('accounts', `Account deletion will be performed for: ${user.email}`)

  // perform the actual deletion
  await Promise.all([
    QuestionInstanceModel.remove({ user: userId }),
    SessionModel.remove({ user: userId }),
    QuestionModel.remove({ user: userId }),
    TagModel.remove({ user: userId }),
    FileModel.remove({ user: userId }),
    UserModel.findByIdAndRemove(userId),
  ])

  sendSlackNotification('accounts', `Account deletion has been performed for: ${user.email}`)
}

/**
 * Resolve account deletion requests
 * Validate the deletion token previosuly sent to the stored email
 * @param {ID} userId
 */
const resolveAccountDeletion = async (userId) => {
  // perform the actual account deletion procedures
  await performAccountDeletion(userId)

  return 'ACCOUNT_DELETED'
}

/**
 * Data import from movo.ch
 * @param {String} dataset Movo Dataset as stringified JSON object
 */
const movoImport = async ({ userId, dataset }) => {
  const movoObject = JSON.parse(dataset)
  const user = await UserModel.findById(userId)

  // TODO: remove
  // console.log(movoObject)
  // console.log('USER ID')
  // console.log(userId)

  // create import from movo tag
  const movoTag = await new TagModel({
    name: 'Import from Movo',
    questions: [],
    user: userId,
  }).save()
  user.tags.push(movoTag.id)

  let questions = []
  let questionInstances = []

  try {
    movoObject.forEach((questionSet) => {
      if (questionSet.questions && questionSet.questions.length !== 0) {
        questions = questions.concat(
          questionSet.questions.map(async (question) => {
            const newQuestion = await new QuestionModel({
              tags: [movoTag.id],
              title: question.title,
              type: question.type,
              user: userId,
              versions: [
                {
                  content: question.title,
                  description: question.title,
                  options: {
                    SC: question.options.SC,
                    MC: question.options.MC,
                    FREE_RANCE: null,
                  },
                  files: [],
                  solution: undefined,
                },
              ],
            }).save()

            movoTag.questions.push(newQuestion.id)
            user.questions.push(newQuestion.id)

            return newQuestion
          })
        )
      }
    })

    await Promise.all([user.save(), movoTag.save()])

    // ! do not change from here on - this part works
    movoObject.forEach(async (questionSet) => {
      if (questionSet.questions && questionSet.questions.length !== 0) {
        // // create instances for session population
        // const sessionId1 = ObjectId()

        // // prepare 8 question instances for the session without results (in pairs of two)
        // questionInstances = Promise(
        //   questions.reduce(async (acc, question) => {
        //     const instances = Promise.all(
        //       [question, question].map(async (questionData) => {
        //         const newInstance = new QuestionInstanceModel({
        //           question: questionData.id,
        //           session: sessionId1,
        //           user: userId,
        //           version: 0,
        //           results: null,
        //         })
        //         return newInstance.save()
        //       })
        //     )
        //     const instanceIds = instances.map((instance) => instance.id)
        //     question.instances.push(...instanceIds)
        //     await question.save()
        //     return [...(await acc), ...instanceIds]
        //   }, Promise.resolve([]))
        // )

        // TODO: create instances

        if (questionSet.results) {
          // TODO: Create Session with results
        } else {
          // TODO: Create Session without results
        }
      }
    })
  } catch (error) {
    console.log(error)
  }
  return true
}

module.exports = {
  checkAvailability,
  checkAccountStatus,
  updateAccountData,
  isValidJWT,
  getToken,
  signup,
  login,
  logout,
  changePassword,
  requestPassword,
  requestAccountDeletion,
  resolveAccountDeletion,
  activateAccount,
  generateScopedToken,
  movoImport,
  AUTH_COOKIE_SETTINGS,
}

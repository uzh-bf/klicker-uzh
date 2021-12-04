const bcrypt = require('bcryptjs')
const JWT = require('jsonwebtoken')
const _get = require('lodash/get')
const passwordGenerator = require('generate-password')
const { isLength, isEmail, normalizeEmail } = require('validator')
const { AuthenticationError, UserInputError } = require('apollo-server-express')

const CFG = require('../klicker.conf.js')
const validators = require('../lib/validators')
const { QuestionInstanceModel, TagModel, FileModel, SessionModel, QuestionModel, UserModel } = require('../models')
const { sendEmailNotification, sendSlackNotification, compileEmailTemplate } = require('./notifications')
const { Errors, ROLES } = require('../constants')
const { createQuestion } = require('./questions')
const { createSession } = require('./sessionMgr')

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

      // demo data is added to populate new user accounts
      const titles = ['Demoquestion SC', 'Demoquestion MC', 'Demoquestion FT', 'Demoquestion NR']
      const types = ['SC', 'MC', 'FREE', 'FREE_RANGE']
      const content = [
        '{"blocks":[{"text":"Which of the following statements is applicable to KlickerUZH?","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}',
        '{"blocks":[{"text":"Which of the following persons have been American presidents? (multiple correct answers possible)","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}',
        '{"blocks":[{"text":"Describe a main principle of a social market economy.","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}',
        '{"blocks":[{"text":"Estimate the length of the longest river in the world (answer in kilometers).","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}',
      ]
      const options = [
        {
          randomized: false,
          restrictions: { min: null, max: null },
          choices: [
            { correct: true, name: 'KlickerUZH is an open-source audience response system' },
            { correct: false, name: 'KlickerUZH is owned by Google' },
            { correct: false, name: 'KlickerUZH cannot be used by everyone' },
            { correct: false, name: 'KlickerUZH is a project of the University of Zurich' },
          ],
        },
        {
          randomized: false,
          restrictions: { min: null, max: null },
          choices: [
            { correct: false, name: 'Barack Obama' },
            { correct: true, name: 'Ted Cruz' },
            { correct: true, name: 'Alexander Hamilton' },
            { correct: false, name: 'John F. Kennedy' },
          ],
        },
        {
          randomized: false,
          restrictions: { min: null, max: null },
          choices: [],
        },
        {
          randomized: false,
          restrictions: { min: 0, max: 8000 },
          choices: [],
        },
      ]
      const solution = undefined
      const files = []
      const tags = ['DEMO']
      const userId = newUser._id
      const demoQuestions = []

      for (let i = 0; i < titles.length; i += 1) {
        demoQuestions.push(
          // eslint-disable-next-line no-await-in-loop
          await createQuestion({
            title: titles[i],
            type: types[i],
            content: content[i],
            options: options[i],
            solution,
            files,
            tags,
            userId,
          })
        )
      }

      await createSession({
        name: 'Demosession',
        questionBlocks: [
          { questions: [{ question: demoQuestions[0]._id, version: 0 }] },
          { questions: [{ question: demoQuestions[2]._id, version: 0 }] },
          {
            questions: [
              { question: demoQuestions[1]._id, version: 0 },
              { question: demoQuestions[3]._id, version: 0 },
            ],
          },
          {
            questions: [
              { question: demoQuestions[0]._id, version: 0 },
              { question: demoQuestions[1]._id, version: 0 },
              { question: demoQuestions[2]._id, version: 0 },
              { question: demoQuestions[3]._id, version: 0 },
            ],
          },
        ],
        participants: [],
        authenticationMode: 'NONE',
        userId,
      })

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
  AUTH_COOKIE_SETTINGS,
}

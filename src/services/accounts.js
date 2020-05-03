const bcrypt = require('bcryptjs')
const JWT = require('jsonwebtoken')
const _get = require('lodash/get')
const passwordGenerator = require('generate-password')
const { isLength, isEmail, normalizeEmail } = require('validator')
const { AuthenticationError, ForbiddenError, UserInputError } = require('apollo-server-express')

const CFG = require('../klicker.conf.js')
const validators = require('../lib/validators')
const { QuestionInstanceModel, TagModel, FileModel, SessionModel, QuestionModel, UserModel } = require('../models')
const { sendEmailNotification, sendSlackNotification, compileEmailTemplate } = require('./notifications')
const { Errors } = require('../constants')

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
  sub: user.id,
  scope,
  shortname: user.shortname,
})

/**
 * Check whether an authentication object is valid
 * @param {Object} auth The authentication object
 */
const isAuthenticated = (auth) => {
  if (auth && auth.sub) {
    return true
  }
  return false
}

/**
 * HOC to ensure the requester is authenticated
 * @param {Function} wrapped The resolver to be secured
 */
const requireAuth = (wrapped) => (parentValue, args, context) => {
  if (!isAuthenticated(context.auth)) {
    throw new AuthenticationError('INVALID_LOGIN')
  }
  return wrapped(parentValue, args, context)
}

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
    expiresIn,
  })

/**
 * Verify an arbitrary JWT for validity and correct scoping
 * @param {*} token The JWT to be evaluated
 * @param {*} wantedScope The scope that the JWT should have to pass
 * @param {*} userId The userId that the JWT should be related to
 */
const verifyToken = (token, wantedScope, userId) => {
  // validate the token
  try {
    JWT.verify(token, APP_CFG.secret)
  } catch (e) {
    throw new ForbiddenError(Errors.INVALID_TOKEN)
  }

  // decode the valid token
  const { sub, scope } = JWT.decode(token)

  // ensure that the wanted scope is available
  if ((wantedScope && !scope.includes(wantedScope)) || (userId && sub !== userId)) {
    throw new ForbiddenError(Errors.INVALID_TOKEN)
  }

  return sub
}

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
const signup = async (email, password, shortname, institution, useCase, { isAAI, isActive } = {}) => {
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
    }

    // return the data of the newly created user
    return newUser
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
    user = await signup(auth.sub, password, shortname, auth.org, '-', { isAAI: true, isActive: true })
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
const updateAccountData = async ({ userId, email, shortname, institution, useCase }) => {
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

      // TODO enable after migration
      // user.email = email
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
  // verify the token and extract the userId of the account
  const userId = verifyToken(activationToken, 'activate')

  // activate the user account
  await UserModel.findByIdAndUpdate(userId, {
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
 * @param {String} deletionToken
 */
const resolveAccountDeletion = async (userId, deletionToken) => {
  // verify the deletion token and extract the user id
  const userToDelete = verifyToken(deletionToken, 'delete', userId)

  // perform the actual account deletion procedures
  await performAccountDeletion(userToDelete)

  return 'ACCOUNT_DELETED'
}

module.exports = {
  checkAvailability,
  checkAccountStatus,
  updateAccountData,
  isAuthenticated,
  requireAuth,
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

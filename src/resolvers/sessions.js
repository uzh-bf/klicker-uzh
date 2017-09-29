const AuthService = require('../services/auth')
const SessionService = require('../services/sessions')
const { SessionModel, UserModel } = require('../models')

/* ----- queries ----- */
const allSessionsQuery = async (parentValue, args, { auth }) => {
  AuthService.isAuthenticated(auth)

  const user = await UserModel.findById(auth.sub).populate(['sessions'])
  return user.sessions
}

const sessionQuery = async (parentValue, { id }, { auth }) => {
  AuthService.isAuthenticated(auth)

  return SessionModel.findOne({ id, user: auth.sub })
}

/* ----- mutations ----- */
const createSessionMutation = async (parentValue, { session: { name, blocks } }, { auth }) => {
  AuthService.isAuthenticated(auth)

  return SessionService.createSession({
    name,
    questionBlocks: blocks,
    user: auth.sub,
  })
}

const startSessionMutation = async (parentValue, { id }, { auth }) => {
  AuthService.isAuthenticated(auth)

  return SessionService.startSession({ id, userId: auth.sub })
}

const endSessionMutation = async (parentValue, { id }, { auth }) => {
  AuthService.isAuthenticated(auth)

  return SessionService.endSession({ id, userId: auth.sub })
}

module.exports = {
  allSessions: allSessionsQuery,
  createSession: createSessionMutation,
  endSession: endSessionMutation,
  session: sessionQuery,
  startSession: startSessionMutation,
}

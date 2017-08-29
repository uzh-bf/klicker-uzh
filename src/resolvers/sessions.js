const AuthService = require('../services/auth')
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
const createSessionMutation = async (parentValue, { session: { name } }, { auth }) => {
  AuthService.isAuthenticated(auth)

  const newSession = await new SessionModel({ name, user: auth.sub }).save()

  await UserModel.update(
    { _id: auth.sub },
    {
      $push: { sessions: newSession.id },
      $currentDate: { updatedAt: true },
    },
  )

  return newSession
}

module.exports = {
  allSessions: allSessionsQuery,
  createSession: createSessionMutation,
  session: sessionQuery,
}

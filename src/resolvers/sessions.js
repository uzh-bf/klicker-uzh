const SessionService = require('../services/sessions')
const { SessionModel, UserModel } = require('../models')

/* ----- queries ----- */
const allSessionsQuery = async (parentValue, args, { auth }) => {
  const user = await UserModel.findById(auth.sub).populate(['sessions'])
  return user.sessions
}

const sessionByIDQuery = (parentValue, { id }) => SessionModel.findById(id)
const sessionsByPVQuery = parentValue => SessionModel.find({ _id: { $in: parentValue.sessions } })

/* ----- mutations ----- */
const createSessionMutation = (parentValue, { session: { name, blocks } }, { auth }) =>
  SessionService.createSession({
    name,
    questionBlocks: blocks,
    userId: auth.sub,
  })

const startSessionMutation = (parentValue, { id }, { auth }) => SessionService.startSession({ id, userId: auth.sub })

const endSessionMutation = (parentValue, { id }, { auth }) => SessionService.endSession({ id, userId: auth.sub })

module.exports = {
  // queries
  allSessions: allSessionsQuery,
  session: sessionByIDQuery,
  sessionsByPV: sessionsByPVQuery,

  // mutations
  createSession: createSessionMutation,
  endSession: endSessionMutation,
  startSession: startSessionMutation,
}

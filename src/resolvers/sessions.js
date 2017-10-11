const SessionService = require('../services/sessions')
const { SessionModel, UserModel } = require('../models')

/* ----- queries ----- */
const allSessionsQuery = async (parentValue, args, { auth }) => {
  const user = await UserModel.findById(auth.sub).populate(['sessions'])
  return user.sessions
}

const sessionByIDQuery = (parentValue, { id }) => SessionModel.findById(id)
const sessionByPVQuery = parentValue => SessionModel.findById(parentValue.runningSession)
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

const addFeedbackMutation = (parentValue, { sessionId, content }) => SessionService.addFeedback({ sessionId, content })

const addConfusionTSMutation = (parentValue, { sessionId, difficulty, speed }) =>
  SessionService.addConfusionTS({ sessionId, difficulty, speed })

const updateSessionSettingsMutation = (parentValue, { sessionId, settings }, { auth }) =>
  SessionService.updateSettings({
    sessionId,
    userId: auth.sub,
    settings,
  })

module.exports = {
  // queries
  allSessions: allSessionsQuery,
  session: sessionByIDQuery,
  sessionByPV: sessionByPVQuery,
  sessionsByPV: sessionsByPVQuery,

  // mutations
  createSession: createSessionMutation,
  endSession: endSessionMutation,
  startSession: startSessionMutation,
  addFeedback: addFeedbackMutation,
  addConfusionTS: addConfusionTSMutation,
  updateSessionSettings: updateSessionSettingsMutation,
}

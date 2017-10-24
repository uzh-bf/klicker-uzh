const SessionMgrService = require('../services/sessionMgr')
const SessionExecService = require('../services/sessionExec')
const { SessionModel, UserModel } = require('../models')

/* ----- queries ----- */
const allSessionsQuery = async (parentValue, args, { auth }) => {
  const user = await UserModel.findById(auth.sub).populate(['sessions'])
  return user.sessions
}

const runningSessionQuery = async (parentValue, args, { auth }) => {
  const user = await UserModel.findById(auth.sub).populate('runningSession')
  return user.runningSession
}

const sessionByIDQuery = (parentValue, { id }) => SessionModel.findById(id)
const sessionByPVQuery = parentValue => SessionModel.findById(parentValue.runningSession)
const sessionsByPVQuery = parentValue => SessionModel.find({ _id: { $in: parentValue.sessions } })

/* ----- mutations ----- */
const createSessionMutation = (parentValue, { session: { name, blocks } }, { auth }) =>
  SessionMgrService.createSession({
    name,
    questionBlocks: blocks,
    userId: auth.sub,
  })

const startSessionMutation = (parentValue, { id }, { auth }) => SessionMgrService.startSession({ id, userId: auth.sub })

const activateNextBlockMutation = (parentValue, args, { auth }) =>
  SessionMgrService.activateNextBlock({ userId: auth.sub })

const endSessionMutation = (parentValue, { id }, { auth }) => SessionMgrService.endSession({ id, userId: auth.sub })

const addFeedbackMutation = (parentValue, { sessionId, content }) =>
  SessionExecService.addFeedback({ sessionId, content })

const addConfusionTSMutation = (parentValue, { sessionId, difficulty, speed }) =>
  SessionExecService.addConfusionTS({ sessionId, difficulty, speed })

const updateSessionSettingsMutation = (parentValue, { sessionId, settings }, { auth }) =>
  SessionMgrService.updateSettings({
    sessionId,
    userId: auth.sub,
    settings,
  })

module.exports = {
  // queries
  allSessions: allSessionsQuery,
  runningSession: runningSessionQuery,
  session: sessionByIDQuery,
  sessionByPV: sessionByPVQuery,
  sessionsByPV: sessionsByPVQuery,

  // mutations
  createSession: createSessionMutation,
  endSession: endSessionMutation,
  activateNextBlock: activateNextBlockMutation,
  startSession: startSessionMutation,
  addFeedback: addFeedbackMutation,
  addConfusionTS: addConfusionTSMutation,
  updateSessionSettings: updateSessionSettingsMutation,
}

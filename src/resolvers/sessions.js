const moment = require('moment')

const SessionMgrService = require('../services/sessionMgr')
const SessionExecService = require('../services/sessionExec')
const { SessionModel, UserModel } = require('../models')

/* ----- queries ----- */
const allSessionsQuery = async (parentValue, args, { auth }) => {
  const user = await UserModel.findById(auth.sub).populate(['sessions'])
  return user.sessions
}
const sessionQuery = async (parentValue, { id }, { auth }) => SessionModel.findOne({ _id: id, user: auth.sub })

const runningSessionQuery = async (parentValue, args, { auth }) => {
  const user = await UserModel.findById(auth.sub).populate('runningSession')
  return user.runningSession
}

const sessionByPVQuery = parentValue => SessionModel.findById(parentValue.runningSession)
const sessionsByPVQuery = parentValue => SessionModel.find({ _id: { $in: parentValue.sessions } })

const joinSessionQuery = async (parentValue, { shortname }) => SessionExecService.joinSession({ shortname })

// calculate the session runtime
const runtimeByPVQuery = ({ startedAt }) => moment.duration(moment().diff(startedAt)).humanize()

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

const deleteFeedbackMutation = (parentValue, { sessionId, feedbackId }, { auth }) =>
  SessionExecService.deleteFeedback({ sessionId, feedbackId, userId: auth.sub })

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
  session: sessionQuery,
  sessionByPV: sessionByPVQuery,
  sessionsByPV: sessionsByPVQuery,
  runtimeByPV: runtimeByPVQuery,

  // mutations
  createSession: createSessionMutation,
  endSession: endSessionMutation,
  activateNextBlock: activateNextBlockMutation,
  startSession: startSessionMutation,
  addFeedback: addFeedbackMutation,
  deleteFeedback: deleteFeedbackMutation,
  addConfusionTS: addConfusionTSMutation,
  updateSessionSettings: updateSessionSettingsMutation,
  joinSession: joinSessionQuery,
}

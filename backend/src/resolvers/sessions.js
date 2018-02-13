const moment = require('moment')

const SessionMgrService = require('../services/sessionMgr')
const SessionExecService = require('../services/sessionExec')
const { SessionModel, UserModel } = require('../models')

/* ----- queries ----- */
const allSessionsQuery = async (parentValue, args, { auth }) =>
  SessionModel.find({ user: auth.sub }).sort({ createdAt: -1 })

const sessionQuery = async (parentValue, { id }, { auth }) => SessionModel.findOne({ _id: id, user: auth.sub })

const runningSessionQuery = async (parentValue, args, { auth }) => {
  const user = await UserModel.findById(auth.sub).populate('runningSession')
  return user.runningSession
}

const sessionByPVQuery = parentValue => SessionModel.findById(parentValue.runningSession)
const sessionsByPVQuery = parentValue => SessionModel.find({ _id: { $in: parentValue.sessions } })

const joinSessionQuery = async (parentValue, { shortname }) => SessionExecService.joinSession({ shortname })

// calculate the session runtime
const runtimeByPVQuery = ({ startedAt }) => {
  const duration = moment.duration(moment().diff(startedAt))
  const days = duration.days()
  const hours = `0${duration.hours()}`.slice(-2)
  const minutes = `0${duration.minutes()}`.slice(-2)
  const seconds = `0${duration.seconds()}`.slice(-2)

  if (days > 0) {
    return `${days}d ${hours}:${minutes}:${seconds}`
  }

  return `${hours}:${minutes}:${seconds}`
}

/* ----- mutations ----- */
const createSessionMutation = (parentValue, { session: { name, blocks } }, { auth }) =>
  SessionMgrService.createSession({
    name,
    questionBlocks: blocks,
    userId: auth.sub,
  })

const startSessionMutation = (parentValue, { id }, { auth }) =>
  SessionMgrService.startSession({ id, userId: auth.sub, shortname: auth.shortname })

const activateNextBlockMutation = (parentValue, args, { auth }) =>
  SessionMgrService.activateNextBlock({ userId: auth.sub, shortname: auth.shortname })

const endSessionMutation = (parentValue, { id }, { auth }) =>
  SessionMgrService.endSession({ id, userId: auth.sub, shortname: auth.shortname })

const addFeedbackMutation = (parentValue, { fp, sessionId, content }, { ip }) =>
  SessionExecService.addFeedback({
    fp,
    ip,
    sessionId,
    content,
  })

const deleteFeedbackMutation = (parentValue, { sessionId, feedbackId }, { auth }) =>
  SessionExecService.deleteFeedback({ sessionId, feedbackId, userId: auth.sub })

const addConfusionTSMutation = (parentValue, {
  fp, sessionId, difficulty, speed,
}, { ip }) =>
  SessionExecService.addConfusionTS({
    fp,
    ip,
    sessionId,
    difficulty,
    speed,
  })

const updateSessionSettingsMutation = (parentValue, { sessionId, settings }, { auth }) =>
  SessionMgrService.updateSettings({
    sessionId,
    userId: auth.sub,
    settings,
    shortname: auth.shortname,
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

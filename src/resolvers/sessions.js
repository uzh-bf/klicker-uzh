const moment = require('moment')

const SessionMgrService = require('../services/sessionMgr')
const SessionExecService = require('../services/sessionExec')
const { SessionModel, UserModel } = require('../models')
const { ensureLoaders } = require('../lib/loaders')

/* ----- queries ----- */
const allSessionsQuery = async (parentValue, args, { auth, loaders }) => {
  // get all the sessions for the given user
  const results = await SessionModel.find({ user: auth.sub }).sort({ createdAt: -1 })

  // prime the dataloader cache
  results.forEach((session) => ensureLoaders(loaders).sessions.prime(session.id, session))

  return results
}

const sessionQuery = async (parentValue, { id }, { auth, loaders }) => {
  // load the requested session
  const session = await ensureLoaders(loaders).sessions.load(id)

  if (typeof auth !== 'undefined' || session.settings.isEvaluationPublic) {
    return session
  }

  return null
}
const sessionByPVQuery = (parentValue, args, { loaders }) => {
  if (!parentValue.runningSession) {
    return null
  }

  return ensureLoaders(loaders).sessions.load(parentValue.runningSession)
}
const sessionsByPVQuery = (parentValue, args, { loaders }) => {
  const loader = ensureLoaders(loaders).sessions
  return Promise.all(parentValue.sessions.map((session) => loader.load(session)))
}

const runningSessionQuery = async (parentValue, args, { auth }) => {
  const user = await UserModel.findById(auth.sub).populate('runningSession')
  return user.runningSession
}

const joinSessionQuery = async (parentValue, { shortname }, { auth }) =>
  SessionExecService.joinSession({ shortname, auth })

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
const createSessionMutation = (parentValue, { session: { name, blocks, participants, storageMode } }, { auth }) =>
  SessionMgrService.createSession({ name, questionBlocks: blocks, participants, storageMode, userId: auth.sub })

const modifySessionMutation = (parentValue, { id, session: { name, blocks, participants, storageMode } }, { auth }) =>
  SessionMgrService.modifySession({ id, name, participants, storageMode, questionBlocks: blocks, userId: auth.sub })

const startSessionMutation = (parentValue, { id }, { auth }) => SessionMgrService.startSession({ id, userId: auth.sub })

const activateNextBlockMutation = (parentValue, args, { auth }) =>
  SessionMgrService.activateNextBlock({ userId: auth.sub })

const activateBlockByIdMutation = (parentValue, { blockId, sessionId }, { auth }) =>
  SessionMgrService.activateBlockById({ userId: auth.sub, sessionId, blockId })

const pauseSessionMutation = (parentValue, { id }, { auth }) => SessionMgrService.pauseSession({ id, userId: auth.sub })

const cancelSessionMutation = (parentValue, { id }, { auth }) =>
  SessionMgrService.cancelSession({ id, userId: auth.sub })

const resetQuestionBlockMutation = (parentValue, { sessionId, blockId }, { auth }) =>
  SessionExecService.resetQuestionBlock({ sessionId, blockId, userId: auth.sub })

const endSessionMutation = (parentValue, { id }, { auth }) => SessionMgrService.endSession({ id, userId: auth.sub })

const addFeedbackMutation = async (parentValue, { sessionId, content }) => {
  await SessionExecService.addFeedback({ sessionId, content })

  return 'FEEDBACK_ADDED'
}

const deleteFeedbackMutation = (parentValue, { sessionId, feedbackId }, { auth }) =>
  SessionExecService.deleteFeedback({ sessionId, feedbackId, userId: auth.sub })

const addConfusionTSMutation = async (parentValue, { sessionId, difficulty, speed }) => {
  await SessionExecService.addConfusionTS({ sessionId, difficulty, speed })

  return 'CONFUSION_ADDED'
}

const updateSessionSettingsMutation = (parentValue, { sessionId, settings }, { auth }) =>
  SessionMgrService.updateSettings({ sessionId, userId: auth.sub, settings, shortname: auth.shortname })

const deleteSessionsMutation = (parentValue, { ids }, { auth }) =>
  SessionMgrService.deleteSessions({ userId: auth.sub, ids })

const modifyQuestionBlockMutation = (parentValue, { sessionId, id, questionBlockSettings }, { auth }) =>
  SessionMgrService.modifyQuestionBlock({ id, sessionId, userId: auth.sub, questionBlockSettings })

const loginParticipantMutation = (parentValue, { sessionId, username, password }, { res }) =>
  SessionExecService.loginParticipant({ sessionId, username, password, res })

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
  modifySession: modifySessionMutation,
  endSession: endSessionMutation,
  activateNextBlock: activateNextBlockMutation,
  activateBlockById: activateBlockByIdMutation,
  pauseSession: pauseSessionMutation,
  cancelSession: cancelSessionMutation,
  startSession: startSessionMutation,
  addFeedback: addFeedbackMutation,
  deleteFeedback: deleteFeedbackMutation,
  addConfusionTS: addConfusionTSMutation,
  updateSessionSettings: updateSessionSettingsMutation,
  joinSession: joinSessionQuery,
  deleteSessions: deleteSessionsMutation,
  resetQuestionBlock: resetQuestionBlockMutation,
  modifyQuestionBlock: modifyQuestionBlockMutation,
  loginParticipant: loginParticipantMutation,
}

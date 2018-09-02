const moment = require('moment')

const SessionMgrService = require('../services/sessionMgr')
const SessionExecService = require('../services/sessionExec')
const { SessionModel, UserModel } = require('../models')
const { ensureLoaders } = require('../lib/loaders')

/* ----- queries ----- */
const allSessionsQuery = async (parentValue, args, { auth, loaders }) => {
  // get all the sessions for the given user
  const results = await SessionModel.find({ user: auth.sub }).sort({
    createdAt: -1,
  })

  // prime the dataloader cache
  results.forEach(session => ensureLoaders(loaders).sessions.prime(session.id, session))

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
const sessionsByPVQuery = (parentValue, args, { loaders }) =>
  ensureLoaders(loaders).sessions.loadMany(parentValue.sessions)

const runningSessionQuery = async (parentValue, args, { auth }) => {
  const user = await UserModel.findById(auth.sub).populate('runningSession')
  return user.runningSession
}

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

const modifySessionMutation = (parentValue, { id, session: { name, blocks } }, { auth }) =>
  SessionMgrService.modifySession({
    id,
    name,
    questionBlocks: blocks,
    userId: auth.sub,
  })

const startSessionMutation = (parentValue, { id }, { auth }) =>
  SessionMgrService.startSession({
    id,
    userId: auth.sub,
  })

const activateNextBlockMutation = (parentValue, args, { auth }) =>
  SessionMgrService.activateNextBlock({
    userId: auth.sub,
  })

const pauseSessionMutation = (parentValue, { id }, { auth }) =>
  SessionMgrService.pauseSession({
    id,
    userId: auth.sub,
  })

const endSessionMutation = (parentValue, { id }, { auth }) =>
  SessionMgrService.endSession({
    id,
    userId: auth.sub,
  })

const addFeedbackMutation = async (parentValue, { fp, sessionId, content }, { ip }) => {
  await SessionExecService.addFeedback({
    fp,
    ip,
    sessionId,
    content,
  })

  return 'FEEDBACK_ADDED'
}

const deleteFeedbackMutation = (parentValue, { sessionId, feedbackId }, { auth }) =>
  SessionExecService.deleteFeedback({ sessionId, feedbackId, userId: auth.sub })

const addConfusionTSMutation = async (parentValue, { fp, sessionId, difficulty, speed }, { ip }) => {
  await SessionExecService.addConfusionTS({
    fp,
    ip,
    sessionId,
    difficulty,
    speed,
  })

  return 'CONFUSION_ADDED'
}

const updateSessionSettingsMutation = (parentValue, { sessionId, settings }, { auth }) =>
  SessionMgrService.updateSettings({
    sessionId,
    userId: auth.sub,
    settings,
    shortname: auth.shortname,
  })

const deleteSessionsMutation = (parentValue, { ids }, { auth }) =>
  SessionMgrService.deleteSessions({ userId: auth.sub, ids })

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
  pauseSession: pauseSessionMutation,
  startSession: startSessionMutation,
  addFeedback: addFeedbackMutation,
  deleteFeedback: deleteFeedbackMutation,
  addConfusionTS: addConfusionTSMutation,
  updateSessionSettings: updateSessionSettingsMutation,
  joinSession: joinSessionQuery,
  deleteSessions: deleteSessionsMutation,
}

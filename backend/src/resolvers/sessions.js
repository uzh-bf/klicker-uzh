const SessionMgrService = require('../services/sessionMgr')
const SessionExecService = require('../services/sessionExec')
const { SessionModel, UserModel } = require('../models')
const { ensureLoaders } = require('../lib/loaders')
const { SESSION_STATUS } = require('../constants')

/* ----- queries ----- */
const allRunningSessionsQuery = async (parentValue, args, { loaders }) => {
  // get all currently running Sessions
  const results = await SessionModel.find({ status: SESSION_STATUS.RUNNING }).populate('user')
  // prime the dataloader cache
  results.forEach((session) => ensureLoaders(loaders).sessions.prime(session.id, session))

  return results
}
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

const pinnedFeedbacksQuery = async (parentValue, args, { auth }) => {
  const user = await UserModel.findById(auth.sub).populate('runningSession')
  return user.runningSession.feedbacks.filter((feedback) => feedback.pinned)
}

const joinSessionQuery = async (parentValue, { shortname }, { auth }) =>
  SessionExecService.joinSession({ shortname, auth })

/* ----- mutations ----- */

const createSessionMutation = (
  parentValue,
  { session: { name, blocks, participants, authenticationMode, storageMode } },
  { auth }
) =>
  SessionMgrService.createSession({
    name,
    questionBlocks: blocks,
    authenticationMode,
    participants,
    storageMode,
    userId: auth.sub,
  })

const modifySessionMutation = (
  parentValue,
  { id, session: { name, blocks, participants, authenticationMode, storageMode } },
  { auth }
) =>
  SessionMgrService.modifySession({
    id,
    name,
    participants,
    authenticationMode,
    storageMode,
    questionBlocks: blocks,
    userId: auth.sub,
  })

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

const abortSessionMutation = (parentValue, { id }) => SessionMgrService.abortSession({ id })

const endSessionMutation = (parentValue, { id }, { auth }) => SessionMgrService.endSession({ id, userId: auth.sub })

const addFeedbackMutation = async (parentValue, { sessionId, content }) =>
  SessionExecService.addFeedback({ sessionId, content })

const deleteFeedbackMutation = (parentValue, { sessionId, feedbackId }, { auth }) =>
  SessionExecService.deleteFeedback({ sessionId, feedbackId, userId: auth.sub })

const pinFeedbackMutation = (_, { sessionId, feedbackId, pinState }, { auth }) =>
  SessionExecService.pinFeedback({ sessionId, feedbackId, pinState, userId: auth.sub })

const publishFeedbackMutation = (_, { sessionId, feedbackId, publishState }, { auth }) =>
  SessionExecService.publishFeedback({ sessionId, feedbackId, publishState, userId: auth.sub })

const upvoteFeedbackMutation = (_, { sessionId, feedbackId, undo }) =>
  SessionExecService.upvoteFeedback({ sessionId, feedbackId, undo })

const reactToFeedbackResponseMutation = (_, { sessionId, feedbackId, responseId, positive, negative }) =>
  SessionExecService.reactToFeedbackResponse({ sessionId, feedbackId, responseId, positive, negative })

const resolveFeedbackMutation = (_, { sessionId, feedbackId, resolvedState }, { auth }) =>
  SessionExecService.resolveFeedback({ sessionId, feedbackId, resolvedState, userId: auth.sub })

const respondToFeedbackMutation = (_, { sessionId, feedbackId, response }, { auth }) =>
  SessionExecService.respondToFeedback({ sessionId, feedbackId, userId: auth.sub, response })

const deleteFeedbackResponseMutation = (_, { sessionId, feedbackId, responseId }, { auth }) =>
  SessionExecService.deleteFeedbackResponse({ sessionId, feedbackId, userId: auth.sub, responseId })

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
  allRunningSessions: allRunningSessionsQuery,
  allSessions: allSessionsQuery,
  runningSession: runningSessionQuery,
  pinnedFeedbacks: pinnedFeedbacksQuery,
  session: sessionQuery,
  sessionByPV: sessionByPVQuery,
  sessionsByPV: sessionsByPVQuery,

  // mutations
  abortSession: abortSessionMutation,
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
  pinFeedback: pinFeedbackMutation,
  publishFeedback: publishFeedbackMutation,
  resolveFeedback: resolveFeedbackMutation,
  respondToFeedback: respondToFeedbackMutation,
  deleteFeedbackResponse: deleteFeedbackResponseMutation,
  upvoteFeedback: upvoteFeedbackMutation,
  reactToFeedbackResponse: reactToFeedbackResponseMutation,
}

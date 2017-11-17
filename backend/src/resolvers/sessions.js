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

const joinSessionQuery = async (parentValue, { shortname }) => {
  const user = await UserModel.findOne({ shortname }).populate([
    { path: 'runningSession', populate: { path: 'activeInstances', populate: { path: 'question' } } },
  ])
  const { runningSession } = user
  const {
    id, activeInstances, settings, feedbacks,
  } = runningSession

  return {
    id,
    settings,
    activeQuestions: activeInstances.map((instance) => {
      const { id: instanceId, question } = instance
      const version = question.versions[instance.version]

      return {
        id: question.id,
        instanceId,
        title: question.title,
        type: question.type,
        description: version.description,
        options: version.options,
      }
    }),
    feedbacks: settings.isFeedbackChannelActive && settings.isFeedbackChannelPublic ? feedbacks : null,
  }
}

const sessionByPVQuery = parentValue => SessionModel.findById(parentValue.runningSession)
const sessionsByPVQuery = parentValue => SessionModel.find({ _id: { $in: parentValue.sessions } })

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

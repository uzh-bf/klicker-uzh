const JWT = require('jsonwebtoken')
const { AuthenticationError, ForbiddenError } = require('apollo-server-express')
const { rule, shield, allow, and } = require('graphql-shield')
const CFG = require('../klicker.conf.js')
const { Errors, ROLES } = require('../constants')

const APP_CFG = CFG.get('app')

const verifyToken = (token, wantedScope, userId) => {
  // validate the token
  try {
    JWT.verify(token, APP_CFG.secret)
  } catch (e) {
    return new ForbiddenError(Errors.INVALID_TOKEN)
  }

  // decode the valid token
  const { sub, scope } = JWT.decode(token)

  // ensure that the wanted scope is available
  if ((wantedScope && !scope.includes(wantedScope)) || (userId && sub !== userId)) {
    return new ForbiddenError(Errors.INVALID_TOKEN)
  }

  return true
}

// checks whether user is logged in
const isAuthenticated = rule({ cache: 'contextual' })(async (parentValue, args, context) => {
  if (context.auth && context.auth.sub) {
    return true
  }
  return new AuthenticationError(Errors.UNAUTHORIZED)
})

// checks whether provided token allows account deletion
const isAccountDeletionPermitted = rule({ cache: 'strict' })(async (parentValue, args, context) => {
  return verifyToken(args.deletionToken, 'delete', context.auth.sub)
})

// checks whether provided token allows account activation
const isAccountActivationPermitted = rule({ cache: 'strict' })(async (parentValue, args) => {
  return verifyToken(args.activationToken, 'activate')
})

// Checks whether user is an admin
const isAdmin = rule({ cache: 'contextual' })(async (parentValue, args, context) => {
  if (context.auth.role === ROLES.ADMIN) {
    return true
  }
  return new AuthenticationError(Errors.UNAUTHORIZED)
})

const permissions = shield(
  {
    // List all requests which require authentication
    Query: {
      allQuestions: isAuthenticated,
      allRunningSessions: and(isAuthenticated, isAdmin),
      allSessions: isAuthenticated,
      allTags: isAuthenticated,
      allUsers: and(isAuthenticated, isAdmin),
      checkAccountStatus: allow,
      checkAvailability: allow,
      joinSession: allow,
      joinQA: allow,
      question: isAuthenticated,
      runningSession: isAuthenticated,
      session: isAuthenticated,
      user: isAuthenticated,
    },

    Mutation: {
      abortSession: and(isAuthenticated, isAdmin),
      activateAccount: isAccountActivationPermitted,
      archiveQuestions: isAuthenticated,
      addFeedback: allow,
      deleteFeedback: isAuthenticated,
      addConfusionTS: allow,
      addResponse: allow,
      changePassword: isAuthenticated,
      createQuestion: isAuthenticated,
      createSession: isAuthenticated,
      createUser: allow,
      deleteQuestions: isAuthenticated,
      deleteResponse: isAuthenticated,
      deleteSessions: isAuthenticated,
      deleteUser: and(isAuthenticated, isAdmin),
      endSession: isAuthenticated,
      login: allow,
      loginParticipant: allow,
      logout: allow,
      modifyQuestion: isAuthenticated,
      modifySession: isAuthenticated,
      modifyUserAsAdmin: and(isAuthenticated, isAdmin),
      modifyUser: isAuthenticated,
      pauseSession: isAuthenticated,
      cancelSession: isAuthenticated,
      requestAccountDeletion: isAuthenticated,
      resolveAccountDeletion: and(isAuthenticated, isAccountDeletionPermitted),
      requestPassword: allow,
      requestPresignedURL: isAuthenticated,
      startSession: isAuthenticated,
      updateSessionSettings: isAuthenticated,
      activateNextBlock: isAuthenticated,
      activateBlockById: isAuthenticated,
      resetQuestionBlock: isAuthenticated,
      modifyQuestionBlock: isAuthenticated,
      questionStatistics: isAuthenticated,
      exportQuestions: isAuthenticated,
    },

    Subscription: {
      // TODO What is the criteria? Being logged in?
      confusionAdded: allow,
      feedbackAdded: allow,
      feedbackResolved: allow,
      feedbackResponseAdded: allow,
      feedbackDeleted: allow,
      publicFeedbackAdded: allow,
      sessionUpdated: allow,
      runningSessionUpdated: allow,
    },
  },
  { allowExternalErrors: true }
)

module.exports = {
  permissions,
  verifyToken,
}

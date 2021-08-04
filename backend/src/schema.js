const { GraphQLDate, GraphQLTime, GraphQLDateTime } = require('graphql-iso-date')

const { requestPresignedURL } = require('./resolvers/files')

const {
  allQuestions,
  createQuestion,
  questionsByPV,
  questionByPV,
  question,
  modifyQuestion,
  archiveQuestions,
  deleteQuestions,
  questionStatistics,
  exportQuestions,
} = require('./resolvers/questions')
const {
  questionInstancesByPV,
  addResponse,
  deleteResponse,
  responsesByPV,
  resultsByPV,
} = require('./resolvers/questionInstances')
const {
  addFeedback,
  deleteFeedback,
  addConfusionTS,
  allRunningSessions,
  allSessions,
  abortSession,
  createSession,
  pauseSession,
  cancelSession,
  endSession,
  joinSession,
  runningSession,
  sessionByPV,
  sessionsByPV,
  startSession,
  updateSessionSettings,
  activateNextBlock,
  activateBlockById,
  session,
  modifySession,
  deleteSessions,
  resetQuestionBlock,
  modifyQuestionBlock,
  loginParticipant,
} = require('./resolvers/sessions')
const { allTags, tags } = require('./resolvers/tags')
const {
  allUsers,
  createUser,
  deleteUser,
  modifyUser,
  modifyUserAsAdmin,
  login,
  logout,
  user,
  authUser,
  changePassword,
  requestPassword,
  hmac,
  checkAvailability,
  requestAccountDeletion,
  resolveAccountDeletion,
  activateAccount,
  checkAccountStatus,
} = require('./resolvers/users')
const { files } = require('./resolvers/files')
const { confusionAdded, feedbackAdded, sessionUpdated, runningSessionUpdated } = require('./resolvers/subscriptions')
const { allTypes } = require('./types')

// create graphql schema in schema language
// define only the root query and mutation here
// remaining types / input types go into types/
const typeDefs = [
  `
  scalar Date
  scalar Time
  scalar DateTime

  schema {
    query: Query
    mutation: Mutation
    subscription: Subscription
  }

  type Query {
    activeInstances: [QuestionInstance]!
    allQuestions: [Question]!
    allRunningSessions: [Session]!
    allSessions: [Session]!
    allTags: [Tag]!
    allUsers: [User]!
    checkAccountStatus: ID
    checkAvailability(email: String, shortname: String): User_Availability!
    joinSession(shortname: String!): Session_Public
    question(id: ID!): Question
    runningSession: Session
    session(id: ID!): Session
    sessionPublic(id: ID!): Session_PublicEvaluation
    user: User
  }

  type Mutation {
    abortSession(id: ID!): Session
    activateAccount(activationToken: String!): String!
    activateNextBlock: Session!
    activateBlockById(sessionId: ID!, blockId: ID!): Session!
    addConfusionTS(fp: ID, sessionId: ID!, difficulty: Int!, speed: Int!): String!
    addFeedback(fp: ID, sessionId: ID!, content: String!): Session_Feedback!
    addResponse(fp: ID, instanceId: ID!, response: QuestionInstance_ResponseInput!): String!
    archiveQuestions(ids: [ID!]!): [Question!]!
    changePassword(newPassword: String!): User!
    createQuestion(question: QuestionInput!): Question!
    createSession(session: SessionInput!): Session!
    createUser(email: String!, password: String!, shortname: String!, institution: String!, useCase: String): User!
    deleteFeedback(sessionId: ID!, feedbackId: ID!): Session!
    deleteQuestions(ids: [ID!]!): String!
    deleteResponse(instanceId: ID!, response: String!): String!
    deleteSessions(ids: [ID!]!): String!
    deleteUser(id: ID!): String!
    endSession(id: ID!): Session!
    login(email: String!, password: String!): ID!
    loginParticipant(sessionId: ID!, username: String, password: String!): ID!
    logout: String!
    modifyQuestionBlock(sessionId: ID!, id: ID!, questionBlockSettings: Session_QuestionBlockModifyInput!): Session!
    modifyQuestion(id: ID!, question: QuestionModifyInput!): Question!
    modifySession(id: ID!, session: SessionModifyInput!): Session!
    modifyUser(user: User_Modify!): User!
    modifyUserAsAdmin(id: ID!, user: User_ModifyAsAdmin!): User!
    pauseSession(id: ID!): Session!
    cancelSession(id: ID!): Session!
    resetSession(id: ID!): Session!
    requestAccountDeletion: String!
    resolveAccountDeletion(deletionToken: String!): String!
    requestPassword(email: String!): String!
    requestPresignedURL(fileType: String!): File_PresignedURL!
    startSession(id: ID!): Session!
    updateSessionSettings(sessionId: ID!, settings: Session_SettingsInput!): Session!
    resetQuestionBlock(sessionId: ID!, blockId: ID!): Session!
    questionStatistics(ids: [ID!]!): [QuestionStatistics!]!
    exportQuestions(ids: [ID!]!): [Question_Export!]!
  }

  type Subscription {
    confusionAdded(sessionId: ID!): Session_ConfusionTimestep
    feedbackAdded(sessionId: ID!): Session_Feedback
    sessionUpdated(sessionId: ID!): Session_Public
    runningSessionUpdated(sessionId: ID!): Session_Update
  }
`,
  ...allTypes,
]

// define graphql resolvers for schema above
// everything imported from their respective modules in resolvers/
const resolvers = {
  Date: GraphQLDate,
  Time: GraphQLTime,
  DateTime: GraphQLDateTime,
  // map queries and mutations
  Query: {
    allQuestions,
    allRunningSessions,
    allSessions,
    allTags,
    allUsers,
    checkAccountStatus,
    checkAvailability,
    joinSession,
    question,
    runningSession,
    session,
    sessionPublic: session,
    user: authUser,
  },
  Mutation: {
    abortSession,
    activateAccount,
    archiveQuestions,
    addFeedback,
    deleteFeedback,
    addConfusionTS,
    addResponse,
    changePassword,
    createQuestion,
    createSession,
    createUser,
    deleteQuestions,
    deleteResponse,
    deleteSessions,
    deleteUser,
    endSession,
    login,
    loginParticipant,
    logout,
    modifyQuestion,
    modifySession,
    modifyUser,
    modifyUserAsAdmin,
    pauseSession,
    cancelSession,
    requestAccountDeletion,
    resolveAccountDeletion,
    requestPassword,
    requestPresignedURL,
    startSession,
    updateSessionSettings,
    activateNextBlock,
    activateBlockById,
    resetQuestionBlock,
    modifyQuestionBlock,
    questionStatistics,
    exportQuestions,
  },
  Subscription: {
    // TODO: some form of authentication
    confusionAdded,
    feedbackAdded,
    sessionUpdated,
    runningSessionUpdated,
  },
  // map our own types
  Question: {
    instances: questionInstancesByPV,
    tags,
    user,
  },
  QuestionOptions: {
    __resolveType(obj) {
      if (obj.FREE_RANGE) {
        return 'FREEQuestionOptions'
      }

      if (obj.SC || obj.MC) {
        return 'SCQuestionOptions'
      }

      return null
    },
  },
  QuestionOptions_Public: {
    __resolveType(obj) {
      if (obj.FREE_RANGE) {
        return 'FREEQuestionOptions_Public'
      }

      if (obj.SC || obj.MC) {
        return 'SCQuestionOptions_Public'
      }

      return null
    },
  },
  QuestionInstance: {
    question: questionByPV,
    responses: responsesByPV,
    results: resultsByPV,
    session: (pv) => String(pv.session), // HACK: fix broken ID coercion of graphql 14.0.0
  },
  QuestionInstance_Public: {
    question: questionByPV,
    results: resultsByPV,
  },
  QuestionInstance_Results: {
    __resolveType(obj) {
      if (obj.FREE) {
        return 'FREEQuestionResults'
      }

      if (obj.CHOICES) {
        return 'SCQuestionResults'
      }

      return null
    },
  },
  Question_Version: {
    files,
  },
  Question_Version_Public: {
    files,
  },
  Session: {
    user,
  },
  Session_QuestionBlock: {
    instances: questionInstancesByPV,
  },
  Session_QuestionBlock_Public: {
    instances: questionInstancesByPV,
  },
  Tag: {
    questions: questionsByPV,
    user,
  },
  User: {
    questions: questionsByPV,
    runningSession: sessionByPV,
    sessions: sessionsByPV,
    tags,
    files,
    hmac,
  },
}

// use graphql-tools to generate a usable schema for export
module.exports = {
  resolvers,
  typeDefs,
}

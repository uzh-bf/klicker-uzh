const { requireAuth } = require('./services/auth')
const {
  allQuestions,
  createQuestion,
  questionsByPV,
  questionByPV,
  question,
  modifyQuestion,
  archiveQuestions,
} = require('./resolvers/questions')
const {
  questionInstancesByPV,
  addResponse,
  responsesByPV,
  resultsByPV,
} = require('./resolvers/questionInstances')
const {
  addFeedback,
  deleteFeedback,
  addConfusionTS,
  allSessions,
  createSession,
  pauseSession,
  endSession,
  joinSession,
  runningSession,
  sessionByPV,
  sessionIdByPV,
  sessionsByPV,
  startSession,
  updateSessionSettings,
  activateNextBlock,
  runtimeByPV,
  session,
  modifySession,
} = require('./resolvers/sessions')
const { allTags, tags } = require('./resolvers/tags')
const {
  createUser,
  login,
  logout,
  user,
  authUser,
  changePassword,
  requestPassword,
} = require('./resolvers/users')
const { confusionAdded, feedbackAdded } = require('./resolvers/subscriptions')
const { allTypes } = require('./types')

// create graphql schema in schema language
// define only the root query and mutation here
// remaining types / input types go into types/
const typeDefs = [
  `
  schema {
    query: Query
    mutation: Mutation
    subscription: Subscription
  }

  type Query {
    activeInstances: [QuestionInstance]!
    allQuestions: [Question]!
    allSessions: [Session]!
    allTags: [Tag]!
    joinSession(shortname: String!): Session_Public
    question(id: ID!): Question
    runningSession: Session
    session(id: ID!): Session
    sessionPublic(id: ID!): Session_PublicEvaluation
    user: User
  }

  type Mutation {
    activateNextBlock: Session!
    addConfusionTS(fp: ID, sessionId: ID!, difficulty: Int!, speed: Int!): String!
    addFeedback(fp: ID, sessionId: ID!, content: String!): String!
    addResponse(fp: ID, instanceId: ID!, response: QuestionInstance_ResponseInput!): String!
    archiveQuestions(ids: [ID!]!): [Question!]!
    changePassword(newPassword: String!): User!
    createQuestion(question: QuestionInput!): Question!
    createSession(session: SessionInput!): Session!
    createUser(email: String!, password: String!, shortname: String!, institution: String!, useCase: String): User!
    deleteFeedback(sessionId: ID!, feedbackId: ID!): Session!
    endSession(id: ID!): Session!
    login(email: String!, password: String!): ID!
    logout: String!
    modifyQuestion(id: ID!, question: QuestionModifyInput!): Question!
    modifySession(id: ID!, session: SessionModifyInput!): Session!
    pauseSession(id: ID!): Session!
    requestPassword(email: String!): String!
    startSession(id: ID!): Session!
    updateSessionSettings(sessionId: ID!, settings: Session_SettingsInput!): Session!
  }

  type Subscription {
    confusionAdded(sessionId: ID!): Session_ConfusionTimestep
    feedbackAdded(sessionId: ID!): Session_Feedback
  }
`,
  ...allTypes,
]

// define graphql resolvers for schema above
// everything imported from their respective modules in resolvers/
const resolvers = {
  // map queries and mutations
  Query: {
    allQuestions: requireAuth(allQuestions),
    allSessions: requireAuth(allSessions),
    allTags: requireAuth(allTags),
    joinSession,
    question: requireAuth(question),
    runningSession: requireAuth(runningSession),
    session: requireAuth(session),
    sessionPublic: session,
    user: requireAuth(authUser),
  },
  Mutation: {
    archiveQuestions: requireAuth(archiveQuestions),
    addFeedback,
    deleteFeedback: requireAuth(deleteFeedback),
    addConfusionTS,
    addResponse,
    changePassword: requireAuth(changePassword),
    createQuestion: requireAuth(createQuestion),
    createSession: requireAuth(createSession),
    createUser,
    endSession: requireAuth(endSession),
    login,
    logout,
    modifyQuestion: requireAuth(modifyQuestion),
    modifySession: requireAuth(modifySession),
    pauseSession: requireAuth(pauseSession),
    requestPassword,
    startSession: requireAuth(startSession),
    updateSessionSettings: requireAuth(updateSessionSettings),
    activateNextBlock: requireAuth(activateNextBlock),
  },
  Subscription: {
    // TODO: authentication
    confusionAdded,
    feedbackAdded,
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
    session: sessionIdByPV,
    responses: responsesByPV,
    results: resultsByPV,
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
  Session: {
    user,
    runtime: runtimeByPV,
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
  },
}

// use graphql-tools to generate a usable schema for export
module.exports = {
  resolvers,
  typeDefs,
}

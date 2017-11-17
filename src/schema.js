const { makeExecutableSchema } = require('graphql-tools')

const { requireAuth } = require('./services/auth')
const {
  allQuestions, createQuestion, questionsByPV, questionByPV, question,
} = require('./resolvers/questions')
const {
  activeInstances,
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
  endSession,
  joinSession,
  runningSession,
  sessionByPV,
  sessionsByPV,
  startSession,
  updateSessionSettings,
  activateNextBlock,
  runtimeByPV,
  session,
} = require('./resolvers/sessions')
const { allTags, tags } = require('./resolvers/tags')
const {
  createUser, login, user, authUser,
} = require('./resolvers/users')
const { allTypes } = require('./types')

// create graphql schema in schema language
// define only the root query and mutation here
// remaining types / input types go into types/
const typeDefs = [
  `
  schema {
    query: Query
    mutation: Mutation
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
    user: User
  }

  type Mutation {
    activateNextBlock: Session!
    addConfusionTS(sessionId: ID!, difficulty: Int!, speed: Int!): Session!
    addFeedback(sessionId: ID!, content: String!): Session!
    addResponse(instanceId: ID!, response: QuestionInstance_ResponseInput!): QuestionInstance!
    createQuestion(question: QuestionInput!): Question!
    createSession(session: SessionInput!): Session!
    createUser(email: String!, password: String!, shortname: String!): User!
    deleteFeedback(sessionId: ID!, feedbackId: ID!): Session!
    endSession(id: ID!): Session!
    login(email: String!, password: String!): User!
    startSession(id: ID!): Session!
    updateSessionSettings(sessionId: ID!, settings: Session_SettingsInput!): Session!
  }
`,
  ...allTypes,
]

// define graphql resolvers for schema above
// everything imported from their respective modules in resolvers/
const resolvers = {
  Query: {
    allQuestions: requireAuth(allQuestions),
    allSessions: requireAuth(allSessions),
    allTags: requireAuth(allTags),
    activeInstances: requireAuth(activeInstances),
    joinSession,
    question: requireAuth(question),
    runningSession: requireAuth(runningSession),
    session: requireAuth(session),
    user: requireAuth(authUser),
  },
  Mutation: {
    addFeedback,
    deleteFeedback: requireAuth(deleteFeedback),
    addConfusionTS,
    addResponse,
    createQuestion: requireAuth(createQuestion),
    createSession: requireAuth(createSession),
    createUser,
    endSession: requireAuth(endSession),
    login,
    startSession: requireAuth(startSession),
    updateSessionSettings: requireAuth(updateSessionSettings),
    activateNextBlock: requireAuth(activateNextBlock),
  },
  Question: {
    tags,
    user,
  },
  QuestionOptions: {
    __resolveType(obj) {
      if (obj.restrictions) {
        return 'FREEQuestionOptions'
      }
      if (obj.choices) {
        return 'SCQuestionOptions'
      }
      return null
    },
  },
  QuestionInstance: {
    question: questionByPV,
    responses: responsesByPV,
    results: resultsByPV,
  },
  QuestionInstance_Results: {
    __resolveType(obj) {
      if (obj.free) {
        return 'FREEQuestionResults'
      }

      if (obj.choices) {
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
module.exports = makeExecutableSchema({
  resolvers,
  typeDefs,
})

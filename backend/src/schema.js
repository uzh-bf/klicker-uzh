const { makeExecutableSchema } = require('graphql-tools')

const { requireAuth } = require('./services/auth')
const {
  allQuestions, createQuestion, questionsByPV, questionByPV,
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
    user: User

    allQuestions: [Question]!

    allTags: [Tag]!

    allSessions: [Session]!
    activeInstances: [QuestionInstance]!
    runningSession: Session
    joinSession(shortname: String!): Session_Public
  }

  type Mutation {
    createUser(email: String!, password: String!, shortname: String!): User!
    login(email: String!, password: String!): User!

    createQuestion(question: QuestionInput!): Question!

    createSession(session: SessionInput!): Session!
    startSession(id: ID!): Session!
    activateNextBlock: Session!
    endSession(id: ID!): Session!
    addFeedback(sessionId: ID!, content: String!): Session!
    addConfusionTS(sessionId: ID!, difficulty: Int!, speed: Int!): Session!
    updateSessionSettings(sessionId: ID!, settings: Session_SettingsInput!): Session!

    addResponse(instanceId: ID!, response: QuestionInstance_ResponseInput!): QuestionInstance!
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
    runningSession: requireAuth(runningSession),
    user: requireAuth(authUser),
  },
  Mutation: {
    addFeedback,
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

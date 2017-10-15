const { makeExecutableSchema } = require('graphql-tools')

const { requireAuth } = require('./services/auth')
const {
  allQuestions,
  createQuestion,
  questionsByPV,
  questionByPV,
  questionInstancesByPV,
} = require('./resolvers/questions')
const {
  addFeedback,
  addConfusionTS,
  allSessions,
  createSession,
  endSession,
  sessionByPV,
  sessionsByPV,
  startSession,
  updateSessionSettings,
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
    allQuestions: [Question]!
    allSessions: [Session]!
    allTags: [Tag]!
    user: User
  }

  type Mutation {
    createUser(user: UserInput!): User
    login(email: String!, password: String!): User

    createQuestion(question: QuestionInput!): Question!

    createSession(session: SessionInput!): Session!
    startSession(id: ID!): Session!
    endSession(id: ID!): Session!
    addFeedback(sessionId: ID!, content: String!): Session!
    addConfusionTS(sessionId: ID!, difficulty: Int!, speed: Int!): Session!
    updateSessionSettings(sessionId: ID!, settings: Session_SettingsInput!): Session!
  }

  type Subscription {
    getResults(id: ID): QuestionInstance
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
    user: requireAuth(authUser),
  },
  Mutation: {
    addFeedback,
    addConfusionTS,
    createQuestion: requireAuth(createQuestion),
    createSession: requireAuth(createSession),
    createUser,
    endSession: requireAuth(endSession),
    login,
    startSession: requireAuth(startSession),
    updateSessionSettings: requireAuth(updateSessionSettings),
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
  Session_QuestionBlock: {
    instances: questionInstancesByPV,
  },
  QuestionInstance: {
    question: questionByPV,
  },
  Session: {
    user,
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

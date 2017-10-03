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
  allSessions, createSession, endSession, sessionsByPV, startSession,
} = require('./resolvers/sessions')
const { allTags, createTag, tags } = require('./resolvers/tags')
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
    allQuestions: [Question]
    allSessions: [Session]
    allTags: [Tag]
    user: User
  }

  type Mutation {
    createQuestion(question: QuestionInput): Question

    createSession(session: SessionInput): Session
    startSession(id: ID): Session
    endSession(id: ID): Session

    createTag(tag: TagInput): Tag

    createUser(user: UserInput): User
    login(email: String, password: String): User
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
    createQuestion: requireAuth(createQuestion),
    createSession: requireAuth(createSession),
    createTag: requireAuth(createTag),
    createUser,
    endSession: requireAuth(endSession),
    login,
    startSession: requireAuth(startSession),
  },
  Question: {
    tags,
    user,
  },
  QuestionBlock: {
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
    sessions: sessionsByPV,
    tags,
  },
}

// use graphql-tools to generate a usable schema for export
module.exports = makeExecutableSchema({
  resolvers,
  typeDefs,
})

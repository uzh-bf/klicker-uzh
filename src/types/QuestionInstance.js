/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [QuestionInstance]

const QuestionInstance = `
  type QuestionInstance {
    id: ID!
    version: Int!

    question: Question!

    createdAt: String!
    updatedAt: String!
  }
`

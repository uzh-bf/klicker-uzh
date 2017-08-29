/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [QuestionInstance]

const QuestionInstance = `
  type QuestionInstance {
    id: ID!

    question: Question!
    version: Int!

    createdAt: String
    updatedAt: String
  }
`

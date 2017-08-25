/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [Question, Tag]

const Tag = require('./Tag')

const Question = `
  input QuestionInput {
    title: String
    type: String

    tags: [ID]
  }

  type Question {
    id: ID!

    title: String!
    type: String!

    tags: [Tag]

    createdAt: String
    updatedAt: String
  }
`

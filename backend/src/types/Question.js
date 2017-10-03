/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [Question, QuestionInstance, QuestionOption, QuestionVersion, Tag]

const Tag = require('./Tag')
const QuestionInstance = require('./QuestionInstance')
const QuestionVersion = require('./QuestionVersion')
const QuestionOption = require('./QuestionOption')

const Question = `
  input QuestionInput {
    title: String
    type: String

    description: String

    options: [QuestionOptionInput]
    tags: [ID]
  }

  type Question {
    id: ID!

    title: String!
    type: String!
    user: User!

    instances: [QuestionInstance]
    tags: [Tag]
    versions: [QuestionVersion]

    createdAt: String
    updatedAt: String
  }
`

/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [Question, QuestionInstance, Tag, FREEQuestionOptions, SCQuestionOptions]

const Tag = require('./Tag')
const QuestionInstance = require('./QuestionInstance')
const FREEQuestionOptions = require('./questionTypes/FREEQuestionOptions')
const SCQuestionOptions = require('./questionTypes/SCQuestionOptions')

const Question = `
  union QuestionOptions = SCQuestionOptions | FREEQuestionOptions

  input QuestionInput {
    title: String!
    type: String!
    description: String!

    options: QuestionOptionsInput!

    tags: [ID!]!
  }
  input QuestionOptionsInput {
    randomized: Boolean
    restrictions: FREEQuestionOptions_RestrictionsInput
    choices: [SCQuestionOptions_ChoiceInput!]
  }
  type Question {
    id: ID!
    title: String!
    type: String!

    user: User!

    instances: [QuestionInstance!]!
    tags: [Tag!]!
    versions: [Question_Version!]!

    createdAt: String!
    updatedAt: String!
  }

  type Question_Version {
    id: ID!
    description: String!

    options: QuestionOptions!

    instances: [QuestionInstance!]!

    createdAt: String!
    updatedAt: String!
  }
`

/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [Question, QuestionInstance, Tag, FREEQuestionOptions, SCQuestionOptions]

const Tag = require('./Tag')
const QuestionInstance = require('./QuestionInstance')
const FREEQuestionOptions = require('./questionTypes/FREEQuestionOptions')
const SCQuestionOptions = require('./questionTypes/SCQuestionOptions')

const Question = `
  union QuestionOptions = SCQuestionOptions | FREEQuestionOptions

  enum Question_Type {
    SC
    MC
    FREE
    FREE_RANGE
  }

  type Question_Options {
    SC: SCQuestionOptions
    MC: SCQuestionOptions
    FREE_RANGE: FREEQuestionOptions
  }

  type Question_Public {
    id: ID!
    instanceId: ID!
    title: String!
    type: Question_Type!
    description: String!

    options: Question_Options
  }

  input QuestionInput {
    title: String!
    type: Question_Type!
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
    type: Question_Type!

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

    options: Question_Options

    instances: [QuestionInstance!]!

    createdAt: String!
    updatedAt: String!
  }
`

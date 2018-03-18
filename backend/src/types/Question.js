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

  input QuestionOptionsInput {
    randomized: Boolean
    restrictions: FREEQuestionOptions_RestrictionsInput
    choices: [SCQuestionOptions_ChoiceInput!]
  }
  type Question_Options {
    SC: SCQuestionOptions
    MC: SCQuestionOptions
    FREE_RANGE: FREEQuestionOptions
  }

  input Question_SolutionInput {
    SC: [Boolean!]
    MC: [Boolean!]
    FREE: String
    FREE_RANGE: Int
  }
  type Question_Solution {
    SC: [Boolean!]
    MC: [Boolean!]
    FREE: String
    FREE_RANGE: Int
  }

  type Question_Public {
    id: ID!
    instanceId: ID!
    title: String!
    type: Question_Type!
    description: String!

    options: Question_Options
    solution: Question_Solution
  }

  input QuestionInput {
    title: String!
    type: Question_Type!
    description: String!

    options: QuestionOptionsInput!
    solution: Question_SolutionInput

    tags: [ID!]!
  }
  input QuestionModifyInput {
    title: String
    description: String
    options: QuestionOptionsInput
    solution: Question_SolutionInput
    tags: [ID!]
  }
  type Question {
    id: ID!
    title: String!
    type: Question_Type!
    isArchived: Boolean

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
    solution: Question_Solution

    instances: [QuestionInstance!]!

    createdAt: String!
    updatedAt: String!
  }
`

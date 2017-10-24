/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [QuestionInstance]

const QuestionInstance = `
  union QuestionInstance_Results = SCQuestionResults | FREEQuestionResults

  input QuestionInstance_ResponseInput {
    choices: [Int!]
    value: String
  }
  type QuestionInstance_Response {
    id: ID!
    choices: [Int!]
    value: String
    createdAt: String!
  }

  type QuestionInstance {
    id: ID!
    version: Int!
    isOpen: Boolean!

    question: Question!

    responses: [QuestionInstance_Response!]!
    results: QuestionInstance_Results

    createdAt: String!
    updatedAt: String!
  }
`

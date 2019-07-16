module.exports = `
  union QuestionInstance_Results = SCQuestionResults | FREEQuestionResults

  input QuestionInstance_ResponseInput {
    choices: [Int!]
    value: String
  }
  type QuestionInstance_Response {
    id: ID!
    choices: [Int!]
    value: String
    createdAt: DateTime!
  }

  type QuestionInstance {
    id: ID!
    version: Int!
    isOpen: Boolean!

    session: ID!
    question: Question!

    responses: [QuestionInstance_Response!]!
    results: QuestionInstance_Results

    createdAt: DateTime!
    updatedAt: DateTime!
  }
  type QuestionInstance_Public {
    id: ID!
    version: Int!
    isOpen: Boolean!
    question: Question_PublicEvaluation!
    results: QuestionInstance_Results
  }
`

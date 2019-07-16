module.exports = `
  type FREEQuestionResults_Result {
    count: Int!
    key: String!
    value: String!
  }

  type FREEQuestionResults {
    totalParticipants: Int!

    FREE: [FREEQuestionResults_Result!]!
  }
`

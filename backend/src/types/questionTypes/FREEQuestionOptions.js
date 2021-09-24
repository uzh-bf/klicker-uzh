module.exports = `
  type FREEQuestionOptions {
    restrictions: FREEQuestionOptions_Restrictions
  }
  type FREEQuestionOptions_Public {
    restrictions: FREEQuestionOptions_Restrictions_Public
  }

  input FREEQuestionOptions_RestrictionsInput {
    min: Int
    max: Int
  }
  type FREEQuestionOptions_Restrictions {
    min: Int
    max: Int
  }
  type FREEQuestionOptions_Restrictions_Public {
    min: Int
    max: Int
  }
`

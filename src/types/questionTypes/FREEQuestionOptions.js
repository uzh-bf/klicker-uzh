/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [FREEQuestionOptions]

const FREEQuestionOptions = `
  type FREEQuestionOptions {
    restrictions: FREEQuestionOptions_Restrictions
  }

  input FREEQuestionOptions_RestrictionsInput {
    min: Int
    max: Int
  }
  type FREEQuestionOptions_Restrictions {
    min: Int
    max: Int
  }
`

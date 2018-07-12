/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [SCQuestionOptions]

const SCQuestionOptions = `
  type SCQuestionOptions {
    randomized: Boolean!

    choices: [SCQuestionOptions_Choice!]!
  }
  type SCQuestionOptions_Public {
    randomized: Boolean!

    choices: [SCQuestionOptions_Choice_Public!]!
  }

  input SCQuestionOptions_ChoiceInput {
    correct: Boolean!
    name: String!
  }
  type SCQuestionOptions_Choice {
    id: ID!
    correct: Boolean!
    name: String!
  }
  type SCQuestionOptions_Choice_Public {
    id: ID!
    name: String!
  }
`

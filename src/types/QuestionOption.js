/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [QuestionOption]

const QuestionOption = `
  input QuestionOptionInput {
    correct: Boolean!
    name: String
  }

  type QuestionOption {
    correct: Boolean
    name: String
  }
`

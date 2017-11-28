/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [SCQuestionResults]

const SCQuestionResults = `
  type SCQuestionResults {
    CHOICES: [Int!]!
    totalParticipants: Int!
  }
`

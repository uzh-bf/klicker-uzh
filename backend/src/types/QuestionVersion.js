/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [QuestionVersion]

const QuestionVersion = `
  type QuestionVersion {
    description: String!

    instances: [QuestionInstance]

    createdAt: String
    updatedAt: String
  }
`

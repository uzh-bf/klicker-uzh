/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [QuestionInstance, QuestionOption, QuestionVersion]

const QuestionInstance = require('./QuestionInstance')
const QuestionOption = require('./QuestionOption')

const QuestionVersion = `
  type QuestionVersion {
    key: Int
    description: String!

    instances: [QuestionInstance]
    options: [QuestionOption]

    createdAt: String
    updatedAt: String
  }
`

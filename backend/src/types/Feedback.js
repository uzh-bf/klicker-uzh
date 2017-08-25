/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [Feedback]

const Feedback = `
  type Feedback {
    content: String!
    votes: Int

    createdAt: String
  }
`

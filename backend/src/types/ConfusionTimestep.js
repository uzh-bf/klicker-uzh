/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [ConfusionTimestep]

const ConfusionTimestep = `
  type ConfusionTimestep {
    difficulty: Int!
    speed: Int!

    createdAt: String
  }
`

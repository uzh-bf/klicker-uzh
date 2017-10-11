/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [Session, Feedback, ConfusionTimestep, QuestionInstance]

const ConfusionTimestep = require('./ConfusionTimestep')
const Feedback = require('./Feedback')
const QuestionInstance = require('./QuestionInstance')

const Session = `
  enum SessionStatus {
    CREATED
    RUNNING
    COMPLETED
  }

  input Session_QuestionInput {
    id: ID!
  }

  input Session_QuestionBlockInput {
    questions: [Session_QuestionInput]
  }

  input SessionInput {
    name: String!
    blocks: [Session_QuestionBlockInput]!
  }

  input SessionSettingsInput {
    isConfusionBarometerActive: Boolean
    isFeedbackChannelActive: Boolean
    isFeedbackChannelPublic: Boolean
  }

  type SessionSettings {
    isConfusionBarometerActive: Boolean
    isFeedbackChannelActive: Boolean
    isFeedbackChannelPublic: Boolean
  }

  type QuestionBlock {
    key: Int
    status: Int!
    instances: [QuestionInstance]
  }

  type Session {
    id: ID!

    name: String!
    status: Int!
    settings: SessionSettings
    user: User!

    blocks: [QuestionBlock]
    confusionTS: [ConfusionTimestep]
    feedbacks: [Feedback]

    createdAt: String
    updatedAt: String
  }
`

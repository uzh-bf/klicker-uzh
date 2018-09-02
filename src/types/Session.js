/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [Session, QuestionInstance]

const QuestionInstance = require('./QuestionInstance')

const Session = `
  enum Session_Status {
    CREATED
    RUNNING
    PAUSED
    COMPLETED
  }

  enum Session_QuestionBlockStatus {
    PLANNED
    ACTIVE
    EXECUTED
  }

  type Session_Public {
    id: ID!

    settings: Session_Settings!

    activeInstances: [Question_Public]!
    feedbacks: [Session_Feedback!]
  }

  input SessionInput {
    name: String!
    blocks: [Session_QuestionBlockInput!]!
  }
  input SessionModifyInput {
    name: String
    blocks: [Session_QuestionBlockInput!]
  }
  type Session {
    id: ID!
    name: String!
    activeBlock: Int!
    activeStep: Int!
    runtime: String

    status: Session_Status!
    settings: Session_Settings!
    user: User!

    blocks: [Session_QuestionBlock!]!
    confusionTS: [Session_ConfusionTimestep!]!
    feedbacks: [Session_Feedback!]!

    createdAt: DateTime!
    updatedAt: DateTime!
    startedAt: DateTime!
    finishedAt: DateTime!
  }
  type Session_PublicEvaluation {
    id: ID!
    status: Session_Status!

    blocks: [Session_QuestionBlock_Public!]!
  }

  input Session_SettingsInput {
    isConfusionBarometerActive: Boolean
    isEvaluationPublic: Boolean
    isFeedbackChannelActive: Boolean
    isFeedbackChannelPublic: Boolean
  }
  type Session_Settings {
    isConfusionBarometerActive: Boolean!
    isEvaluationPublic: Boolean!
    isFeedbackChannelActive: Boolean!
    isFeedbackChannelPublic: Boolean!
  }

  input Session_QuestionBlockQuestionInput {
    question: ID!
    version: Int!
  }
  input Session_QuestionBlockInput {
    questions: [Session_QuestionBlockQuestionInput!]!
  }
  type Session_QuestionBlock {
    id: ID!

    status: Session_QuestionBlockStatus!

    instances: [QuestionInstance!]!
  }
  type Session_QuestionBlock_Public {
    id: ID!
    status: Session_QuestionBlockStatus!

    instances: [QuestionInstance_Public!]!
  }

  type Session_ConfusionTimestep {
    id: ID!
    difficulty: Int!
    speed: Int!

    createdAt: DateTime!
  }

  type Session_Feedback {
    id: ID!
    content: String!
    votes: Int!

    createdAt: DateTime!
  }
`

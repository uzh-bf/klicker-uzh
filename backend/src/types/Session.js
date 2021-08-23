module.exports = `
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

  enum Session_StorageMode {
    SECRET
    COMPLETE
  }

  enum Session_AuthenticationMode {
    PASSWORD
    AAI
    NONE
  }

  type Session_Public {
    id: ID!

    status: Session_Status!
    timeLimit: Int
    expiresAt: DateTime
    execution: Int

    settings: Session_Settings!

    activeInstances: [Question_Public]!
    feedbacks: [Session_Feedback!]
  }

  input SessionInput {
    name: String!
    blocks: [Session_QuestionBlockInput!]!
    participants: [Session_ParticipantInput!]
    authenticationMode: Session_AuthenticationMode
    storageMode: Session_StorageMode
  }
  input SessionModifyInput {
    name: String
    blocks: [Session_QuestionBlockInput!]
    participants: [Session_ParticipantInput!]
    authenticationMode: Session_AuthenticationMode
    storageMode: Session_StorageMode
  }
  type Session {
    id: ID!
    name: String!
    activeBlock: Int!
    activeStep: Int!
    execution: Int

    status: Session_Status!
    settings: Session_Settings!
    user: User!

    blocks: [Session_QuestionBlock!]!
    confusionTS: [Session_ConfusionTimestep!]!
    feedbacks: [Session_Feedback!]!
    participants: [Session_Participant]!

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
    isParticipantAuthenticationEnabled: Boolean!
    isConfusionBarometerActive: Boolean!
    isEvaluationPublic: Boolean!
    isFeedbackChannelActive: Boolean!
    isFeedbackChannelPublic: Boolean!
    authenticationMode: Session_AuthenticationMode!
    storageMode: Session_StorageMode!
  }

  input Session_ParticipantInput {
    username: String!
    isAAI: Boolean
  }

  type Session_Participant {
    id: ID!

    username: String!
    password: String
  }

  input Session_QuestionBlockQuestionInput {
    question: ID!
    version: Int!
  }
  input Session_QuestionBlockInput {
    timeLimit: Int
    questions: [Session_QuestionBlockQuestionInput!]!
  }
  input Session_QuestionBlockModifyInput {
    timeLimit: Int
  }
  type Session_QuestionBlock {
    id: ID!

    status: Session_QuestionBlockStatus!
    timeLimit: Int
    expiresAt: DateTime

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
    resolved: Boolean!
    pinned: Boolean!

    responses: [Session_FeedbackResponse!]!

    createdAt: DateTime!
  }

  type Session_FeedbackResponse {
    id: ID!

    content: String!

    createdAt: DateTime!
  }

  type Session_Update {
    id: ID!
    activeStep: Int!
    activeBlock: Int!

    blocks: [SessionUpdate_Block!]!
  }

  type SessionUpdate_Block {
    id: ID!
    status: Session_QuestionBlockStatus!
    timeLimit: Int
    expiresAt: DateTime
  }
`

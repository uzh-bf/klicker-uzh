const RegistrationMutation = `
  mutation CreateUser($email: String!, $password: String!, $shortname: String!) {
    createUser(email: $email, password: $password, shortname: $shortname) {
      id
      email
      shortname
    }
  }
`
const RegistrationSerializer = {
  test: ({ createUser }) => !!createUser,
  print: ({ createUser: { email, shortname } }) => `
    createUser {
      email: ${email}
      shortname: ${shortname}
    }
  `,
}

const LoginMutation = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      id
      email
      shortname
      runningSession {
        id
      }
    }
  }
`
const LoginSerializer = {
  test: ({ login }) => !!login,
  print: ({ login: { email, shortname, runningSession } }) => `
    login {
      email: ${email}
      shortname: ${shortname}
      runningSession: ${!!runningSession}
    }
  `,
}

const CreateQuestionMutation = `
  mutation CreateQuestion(
    $title: String!
    $description: String!
    $options: QuestionOptionsInput!
    $type: Question_Type!
    $tags: [ID!]!
  ) {
    createQuestion(
      question: {
        title: $title
        description: $description
        options: $options
        type: $type
        tags: $tags
      }
    ) {
      id
      title
      type
      tags {
        id
        name
      }
      versions {
        id
        description
        options {
          SC {
            choices {
              correct
              name
            }
            randomized
          }
          MC {
            choices {
              correct
              name
            }
            randomized
          }
          FREE_RANGE {
            restrictions {
              min
              max
            }
          }
        }
        createdAt
      }
    }
  }
`
const CreateQuestionSerializer = {
  test: ({ createQuestion }) => !!createQuestion,
  print: ({
    createQuestion: {
      title, type, tags, versions,
    },
  }) => `
    createQuestion {
      title: ${title}
      type: ${type}
      tags: ${tags.map(tag => tag.name)}
      versions: ${versions.map(({ description, options }) => `
        description: ${description}
        options: ${JSON.stringify(options)}
      `)}
    }
  `,
}

const CreateSessionMutation = `
  mutation CreateSession($name: String!, $blocks: [Session_QuestionBlockInput!]!) {
    createSession(session: { name: $name, blocks: $blocks }) {
      id
      confusionTS {
        difficulty
        speed
      }
      feedbacks {
        id
        content
        votes
      }
      blocks {
        id
        status
        instances {
          id
          question {
            id
            title
            type
          }
        }
      }
      settings {
        isConfusionBarometerActive
        isFeedbackChannelActive
        isFeedbackChannelPublic
      }
    }
  }
`
const CreateSessionSerializer = {
  test: ({ createSession }) => !!createSession,
  print: ({
    createSession: {
      confusionTS, feedbacks, blocks, settings,
    },
  }) => `
    createSession {
      confusionTS: ${confusionTS}
      feedbacks: ${feedbacks}
      blocks: ${blocks.map(({ status, instances }) => `
        status: ${status}
        instances: ${instances.map(({ question }) => `
          title: ${question.title}
          type: ${question.type}
        `)}
      `)}
      settings: ${JSON.stringify(settings)}
    }
  `,
}

const StartSessionMutation = `
  mutation StartSession($id: ID!) {
    startSession(id: $id) {
      id
      status
    }
  }
`
const EndSessionMutation = `
  mutation EndSession($id: ID!) {
    endSession(id: $id) {
      id
      status
    }
  }
`
const StartAndEndSessionSerializer = {
  test: ({ endSession, startSession }) => endSession || startSession,
  print: ({ endSession, startSession }) => `
    startSession / endSession {
      status: ${endSession ? endSession.status : startSession.status}
    }
  `,
}

const AddFeedbackMutation = `
  mutation AddFeedback($fp: ID, $sessionId: ID!, $content: String!) {
    addFeedback(fp: $fp, sessionId: $sessionId, content: $content) {
      id
      feedbacks {
        id
        content
        votes
      }
    }
  }
`
const AddFeedbackSerializer = {
  test: ({ addFeedback }) => !!addFeedback,
  print: ({ addFeedback: { feedbacks } }) => `
    addFeedback {
      feedbacks: ${feedbacks.map(({ content, votes }) => `
        content: ${content}
        votes: ${votes}
      `)}
    }
  `,
}

const DeleteFeedbackMutation = `
  mutation DeleteFeedback($sessionId: ID!, $feedbackId: ID!) {
    deleteFeedback(sessionId: $sessionId, feedbackId: $feedbackId) {
      id
      feedbacks {
        id
        content
        votes
      }
    }
  }
`

const AddConfusionTSMutation = `
  mutation AddConfusionTS($fp: ID, $sessionId: ID!, $difficulty: Int!, $speed: Int!) {
    addConfusionTS(fp: $fp, sessionId: $sessionId, difficulty: $difficulty, speed: $speed) {
      id
      confusionTS {
        difficulty
        speed
        createdAt
      }
    }
  }
`
const AddConfusionTSSerializer = {
  test: ({ addConfusionTS }) => !!addConfusionTS,
  print: ({ addConfusionTS: { confusionTS } }) => `
    addConfusionTS {
      confusionTS: ${confusionTS.map(({ difficulty, speed }) => `
        difficulty: ${difficulty}
        speed: ${speed}
      `)}
    }
  `,
}

const UpdateSessionSettingsMutation = `
  mutation UpdateSessionSettings($sessionId: ID!, $settings: Session_SettingsInput!) {
    updateSessionSettings(sessionId: $sessionId, settings: $settings) {
      id
      settings {
        isConfusionBarometerActive
        isFeedbackChannelActive
        isFeedbackChannelPublic
      }
    }
  }
`
const UpdateSessionSettingsSerializer = {
  test: ({ updateSessionSettings }) => !!updateSessionSettings,
  print: ({ updateSessionSettings: { settings } }) => `
    updateSessionSettings {
      settings: ${JSON.stringify(settings)}
    }
  `,
}

const AddResponseMutation = `
  mutation AddResponse($fp: ID, $instanceId: ID!, $response: QuestionInstance_ResponseInput!) {
    addResponse(fp: $fp, instanceId: $instanceId, response: $response) {
      id
    }
  }
`

const ActivateNextBlockMutation = `
  mutation ActivateNextBlock {
    activateNextBlock {
      id
      blocks {
        id
        status
        instances {
          id
          isOpen
        }
      }
    }
  }
`
const ActivateNextBlockSerializer = {
  test: ({ activateNextBlock }) => !!activateNextBlock,
  print: ({ activateNextBlock: { blocks } }) => `
    activateNextBlock {
      blocks: ${blocks.map(({ status, instances }) => `
        status: ${status}
        instances: ${instances.map(instance => instance.isOpen)}
      `)}
    }
  `,
}

module.exports = {
  RegistrationMutation,
  LoginMutation,
  CreateQuestionMutation,
  CreateSessionMutation,
  StartSessionMutation,
  EndSessionMutation,
  AddFeedbackMutation,
  DeleteFeedbackMutation,
  AddConfusionTSMutation,
  UpdateSessionSettingsMutation,
  AddResponseMutation,
  ActivateNextBlockMutation,
  serializers: [
    RegistrationSerializer,
    LoginSerializer,
    CreateQuestionSerializer,
    CreateSessionSerializer,
    StartAndEndSessionSerializer,
    AddFeedbackSerializer,
    AddConfusionTSSerializer,
    UpdateSessionSettingsSerializer,
    ActivateNextBlockSerializer,
  ],
}

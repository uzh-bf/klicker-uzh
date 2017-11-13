import { gql } from 'react-apollo'

export const RegistrationMutation = gql`
  mutation CreateUser($email: String!, $password: String!, $shortname: String!) {
    createUser(user: { email: $email, password: $password, shortname: $shortname }) {
      id
      email
      shortname
    }
  }
`

export const LoginMutation = gql`
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

export const CreateQuestionMutation = gql`
  mutation CreateQuestion(
    $title: String!
    $description: String!
    $options: QuestionOptionsInput!
    $type: String!
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
          ... on SCQuestionOptions {
            choices {
              correct
              name
            }
            randomized
          }
          ... on FREEQuestionOptions {
            restrictions {
              min
              max
              type
            }
          }
        }
        createdAt
      }
    }
  }
`

export const CreateSessionMutation = gql`
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

export const StartSessionMutation = gql`
  mutation StartSession($id: ID!) {
    startSession(id: $id) {
      id
      status
    }
  }
`

export const EndSessionMutation = gql`
  mutation EndSession($id: ID!) {
    endSession(id: $id) {
      id
      status
    }
  }
`

export const AddFeedbackMutation = gql`
  mutation AddFeedback($sessionId: ID!, $content: String!) {
    addFeedback(sessionId: $sessionId, content: $content) {
      id
      feedbacks {
        id
        content
        votes
      }
    }
  }
`

export const AddConfusionTSMutation = gql`
  mutation AddConfusionTS($sessionId: ID!, $difficulty: Int!, $speed: Int!) {
    addConfusionTS(sessionId: $sessionId, difficulty: $difficulty, speed: $speed) {
      id
      confusionTS {
        difficulty
        speed
        createdAt
      }
    }
  }
`

export const UpdateSessionSettingsMutation = gql`
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

export const AddResponseMutation = gql`
  mutation AddResponse($instanceId: ID!, $response: QuestionInstance_ResponseInput!) {
    addResponse(instanceId: $instanceId, response: $response) {
      id
    }
  }
`

export const ActivateNextBlockMutation = gql`
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

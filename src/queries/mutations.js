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
    $description: String
    $options: [QuestionOptionInput]!
    $type: String!
    $tags: [ID]
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
      }
      versions {
        description
        options {
          correct
          name
        }
        createdAt
      }
    }
  }
`

export const CreateSessionMutation = gql`
  mutation CreateSession($name: String!, $blocks: [Session_QuestionBlockInput]!) {
    createSession(session: { name: $name, blocks: $blocks }) {
      id
      title
      type
      tags {
        id
      }
      versions {
        description
        options {
          correct
          name
        }
        createdAt
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

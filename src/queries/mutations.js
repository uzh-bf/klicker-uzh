// @flow

import { gql } from 'react-apollo'

type RegistrationMutationType = {
  id: string,
  email: string,
  shortname: string,
}
const RegistrationMutation = gql`
  mutation CreateUser($email: String!, $password: String!, $shortname: String!) {
    createUser(user: { email: $email, password: $password, shortname: $shortname }) {
      id
      email
      shortname
    }
  }
`

type LoginMutationType = {
  id: string,
  email: string,
  shortname: string,
}
const LoginMutation = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      id
      email
      shortname
    }
  }
`

type CreateQuestionMutationType = {
  id: string,
  title: string,
  options: Array<{
    correct: boolean,
    name: string,
  }>,
  type: string,
  tags: Array<{
    id: string,
  }>,
  versions: Array<{
    description: string,
    createdAt: string,
  }>,
}
const CreateQuestionMutation = gql`
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

export { CreateQuestionMutation, LoginMutation, RegistrationMutation }
export type { CreateQuestionMutationType, LoginMutationType, RegistrationMutationType }

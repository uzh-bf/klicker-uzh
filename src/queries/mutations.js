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
  type: string,
  tags: Array<{
    name: string,
  }>,
  versions: Array<{
    description: string,
    createdAt: string,
  }>,
}
const CreateQuestionMutation = gql`
  mutation CreateQuestion($title: String!, $description: String, $type: String!, $tags: [ID]) {
    createQuestion(
      question: { title: $title, description: $description, type: $type, tags: $tags }
    ) {
      id
      title
      type
      tags {
        id
      }
      versions {
        description
        createdAt
      }
    }
  }
`

export { CreateQuestionMutation, LoginMutation, RegistrationMutation }
export type { CreateQuestionMutationType, LoginMutationType, RegistrationMutationType }

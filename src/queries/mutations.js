// @flow

import { gql } from 'react-apollo'

import type { OptionType, TagType } from '../types'

type RegistrationMutationType = {
  id: string,
  email: string,
  shortname: string,
}
type RegistrationInputType = {
  email: string,
  password: string,
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
type LoginInputType = {
  email: string,
  password: string,
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
type CreateQuestionInputType = {
  title: string,
  description: string,
  options: Array<OptionType>,
  tags: Array<TagType>,
  type: string,
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
export type {
  CreateQuestionInputType,
  CreateQuestionMutationType,
  LoginInputType,
  LoginMutationType,
  RegistrationInputType,
  RegistrationMutationType,
}

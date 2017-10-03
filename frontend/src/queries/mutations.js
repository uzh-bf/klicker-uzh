// @flow

import { gql } from 'react-apollo'

import type { OptionType, TagType } from '../types'

export type RegistrationMutationType = {
  id: string,
  email: string,
  shortname: string,
}
export type RegistrationInputType = {
  email: string,
  password: string,
  shortname: string,
}
export const RegistrationMutation = gql`
  mutation CreateUser($email: String!, $password: String!, $shortname: String!) {
    createUser(user: { email: $email, password: $password, shortname: $shortname }) {
      id
      email
      shortname
    }
  }
`

export type LoginMutationType = {
  id: string,
  email: string,
  shortname: string,
}
export type LoginInputType = {
  email: string,
  password: string,
}
export const LoginMutation = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      id
      email
      shortname
    }
  }
`

export type CreateQuestionMutationType = {
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
export type CreateQuestionInputType = {
  title: string,
  description: string,
  options: Array<OptionType>,
  tags: Array<TagType>,
  type: string,
}
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

export type CreateSessionMutationType = {
  id: string,
  name: string,
}
export type CreateSessionInputType = {
  name: string,
}
export type QuestionBlockInput = {
  questions: Array<{
    id: string,
  }>,
}
export const CreateSessionMutation = gql`
  mutation CreateSession($name: String!, $blocks: [Session_QuestionBlockInput]!) {
    createSession(session: { name: $name, blocks: $blocks }) {
      id
    }
  }
`

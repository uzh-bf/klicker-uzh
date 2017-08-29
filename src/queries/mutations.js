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
  user: {
    id: string,
    email: string,
    shortname: string,
  },
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

export { LoginMutation, RegistrationMutation }
export type { LoginMutationType, RegistrationMutationType }

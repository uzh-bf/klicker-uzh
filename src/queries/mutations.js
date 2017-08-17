// @flow

import { gql } from 'react-apollo'

type RegistrationMutationType = {
  id: string,
  email: string,
  shortname: string,
}
const RegistrationMutation = gql`
  mutation CreateUser($email: String!, $password: String!, $shortname: String!) {
    createUser(
      authProvider: { email: { email: $email, password: $password } }
      shortname: $shortname
    ) {
      id
      email
      shortname
    }
  }
`

type LoginMutationType = {
  token: string,
  user: {
    id: string,
    email: string,
    shortname: string,
  }
}
const LoginMutation = gql`
  mutation LoginUser($email: String!, $password: String!) {
    signinUser(email: { email: $email, password: $password }) {
      token
      user {
        id
        email
        shortname
      }
    }
  }
`

export { LoginMutation, RegistrationMutation }
export type { LoginMutationType, RegistrationMutationType }

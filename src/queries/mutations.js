// @flow

import { gql } from 'react-apollo'

type RegistrationMutationType = {}

const RegistrationMutation = gql`
  mutation CreateUser($email: String!, $password: String!, $shortname: String!) {
    createUser(
      authProvider: { email: { email: $email, password: $password } }
      shortname: $shortname
    ) {
      email
      shortname
    }
  }
`

export { RegistrationMutation }
export type { RegistrationMutationType }

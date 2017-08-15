// @flow

import { gql } from 'react-apollo'

type RegistrationMutationType = {}

const RegistrationMutation = gql`
  mutation CreateUser($email: string!, $password: string!) {
    createUser(authProvider: { email: { $email, $password } }) {
      email
    }
  }

`

export { RegistrationMutation }
export type { RegistrationMutationType }

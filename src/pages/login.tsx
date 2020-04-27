import React from 'react'
import Cookies from 'js-cookie'
import { useRouter } from 'next/router'
import { useMutation } from '@apollo/react-hooks'
import { Message } from 'semantic-ui-react'

import ParticipantLoginForm from '../components/forms/ParticipantLoginForm'
import StaticLayout from '../components/layouts/StaticLayout'
import LoginParticipantMutation from '../graphql/mutations/LoginParticipantMutation.graphql'

function Login(): React.ReactElement {
  const router = useRouter()

  const { shortname, sessionId }: { shortname?: string; sessionId?: string } = router.query

  const [loginParticipant, { error }] = useMutation(LoginParticipantMutation)

  return (
    <StaticLayout pageTitle="Login">
      <Message warning>You need to login before access to the session is granted.</Message>

      {error && <Message error>{error.graphQLErrors[0].message}</Message>}

      <ParticipantLoginForm
        onSubmit={async ({ username, password }): Promise<void> => {
          // perform the login
          const loginResult: any = await loginParticipant({ variables: { sessionId, username, password } })

          // save the user id in a cookie
          if (loginResult.data.loginParticipant) {
            Cookies.set('participantId', loginResult.data.loginParticipant, { secure: true })

            // redirect to the join page
            router.push(`/join/${shortname}`)
          }
        }}
      />
    </StaticLayout>
  )
}

export default Login

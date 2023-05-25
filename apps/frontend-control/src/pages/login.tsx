import { useMutation } from '@apollo/client'
import { LoginUserTokenDocument } from '@klicker-uzh/graphql/dist/ops'
import { Toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import Router from 'next/router'
import { useState } from 'react'
import LoginForm from 'shared-components/src/LoginForm'
import * as Yup from 'yup'

const loginSchema = Yup.object().shape({
  email: Yup.string().required('Geben Sie eine gültige E-Mail Adresse ein'),
  token: Yup.string().required(
    'Geben Sie einen gültigen Token ein. Bitte beachten Sie die bei der Token Generierung angezeigte Gültigkeit.'
  ),
})

function Login() {
  const [error, setError] = useState('')
  const [showError, setShowError] = useState(false)
  const [loginUserToken] = useMutation(LoginUserTokenDocument)

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full pb-20 mx-auto">
      <Formik
        isInitialValid={false}
        initialValues={{ email: '', token: '' }}
        validationSchema={loginSchema}
        onSubmit={async (values) => {
          const id = await loginUserToken({
            variables: {
              email: values.email,
              token: values.token.replace(/\s/g, ''),
            },
          })
          if (id.data?.loginUserToken === null) {
            setError(
              'Login fehlgeschlagen. Bitte überprüfen Sie Ihre E-Mail Adresse und den Token. Beachten Sie die zeitlich begrenzte Gültigkeit des Tokens.'
            )
            setShowError(true)
            return
          }
          Router.push('/')
        }}
      >
        {({ isSubmitting }) => {
          return (
            <LoginForm
              header="Login Controller-App (Token)"
              labelIdentifier="E-Mail Adresse"
              fieldIdentifier="email"
              dataIdentifier={{ cy: 'email-field' }}
              labelSecret="Token"
              fieldSecret="token"
              dataSecret={{ cy: 'token-field' }}
              isSubmitting={isSubmitting}
              usePinField={true}
              installationHint
            />
          )
        }}
      </Formik>
      <Toast
        type="error"
        duration={6000}
        openExternal={showError}
        setOpenExternal={setShowError}
        className={{ root: 'max-w-[30rem]' }}
      >
        {error}
      </Toast>
    </div>
  )
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default Login

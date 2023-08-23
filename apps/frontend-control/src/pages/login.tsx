import { useMutation } from '@apollo/client'
import { LoginUserTokenDocument } from '@klicker-uzh/graphql/dist/ops'
import LoginForm from '@klicker-uzh/shared-components/src/LoginForm'
import { Toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Router from 'next/router'
import { useState } from 'react'
import * as Yup from 'yup'

const loginSchema = Yup.object().shape({
  email: Yup.string().required('Geben Sie eine gültige E-Mail Adresse ein'),
  token: Yup.string().required(
    'Geben Sie einen gültigen Token ein. Bitte beachten Sie die bei der Token Generierung angezeigte Gültigkeit.'
  ),
})

function Login() {
  const t = useTranslations()
  const [error, setError] = useState('')
  const [showError, setShowError] = useState(false)
  const [loginUserToken] = useMutation(LoginUserTokenDocument)

  return (
    <div className="flex flex-col items-center h-full md:justify-center">
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
              header={t('control.login.header')}
              labelIdentifier={t('shared.generic.email')}
              fieldIdentifier="email"
              dataIdentifier={{ cy: 'email-field' }}
              labelSecret={t('shared.generic.token')}
              fieldSecret="token"
              dataSecret={{ cy: 'token-field' }}
              isSubmitting={isSubmitting}
              usePinField={true}
              installAndroid={t('control.login.installAndroid')}
              installIOS={t('control.login.installIOS')}
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

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Login

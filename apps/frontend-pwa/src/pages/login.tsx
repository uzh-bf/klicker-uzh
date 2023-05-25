import { FetchResult, useMutation } from '@apollo/client'
import {
  LoginParticipantDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import LoginForm from 'shared-components/src/LoginForm'
import * as Yup from 'yup'

function Login() {
  const t = useTranslations()
  const router = useRouter()

  const [loginParticipant] = useMutation(LoginParticipantDocument)
  const [error, setError] = useState<string>('')
  const [showError, setShowError] = useState(false)
  const [decodedRedirectPath, setDecodedRedirectPath] = useState('/')

  const loginSchema = Yup.object().shape({
    username: Yup.string().required(t('shared.generic.usernameError')),
    password: Yup.string().required(t('shared.generic.passwordError')),
  })

  useEffect(() => {
    const urlParams = new URLSearchParams(window?.location?.search)
    const redirectTo = urlParams?.get('redirect_to')
    if (redirectTo) {
      setDecodedRedirectPath(decodeURIComponent(redirectTo))
    }
  }, [])

  const onSubmit = async (values: any, { setSubmitting, resetForm }: any) => {
    setError('')
    try {
      const result: FetchResult = await loginParticipant({
        variables: { username: values.username, password: values.password },
        refetchQueries: [SelfDocument],
      })
      const userID: string | null = result.data!.loginParticipant
      if (!userID) {
        setError(t('shared.generic.loginError'))
        setShowError(true)
        setSubmitting(false)
        resetForm()
      } else {
        console.log('Login successful!', userID)

        // redirect to the specified redirect path (default: question pool)
        router.push(decodedRedirectPath)
      }
    } catch (e) {
      console.error(e)
      setError(t('shared.generic.systemError'))
      setShowError(true)
      setSubmitting(false)
      resetForm()
    }
  }

  return (
    <div className="flex flex-col items-center h-full md:justify-center">
      <Formik
        initialValues={{ username: '', password: '' }}
        validationSchema={loginSchema}
        onSubmit={onSubmit}
      >
        {({ isSubmitting }) => {
          return (
            <LoginForm
              header={t('shared.generic.login')}
              labelIdentifier={t('shared.generic.username')}
              fieldIdentifier="username"
              dataIdentifier={{ cy: 'username-field' }}
              labelSecret={t('shared.generic.password')}
              fieldSecret="password"
              dataSecret={{ cy: 'password-field' }}
              isSubmitting={isSubmitting}
              installationHint={true}
            />
          )
        }}
      </Formik>
      <Toast
        type="error"
        duration={6000}
        openExternal={showError}
        setOpenExternal={setShowError}
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

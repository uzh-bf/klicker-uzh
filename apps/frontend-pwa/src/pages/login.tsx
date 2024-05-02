import { FetchResult, useLazyQuery, useMutation } from '@apollo/client'
import {
  LoginParticipantDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import * as Yup from 'yup'
import LoginForm from '../components/forms/LoginForm'

function Login() {
  const t = useTranslations()
  const router = useRouter()

  const [loginParticipant] = useMutation(LoginParticipantDocument)
  const [fetchSelf] = useLazyQuery(SelfDocument, {
    fetchPolicy: 'network-only',
  })
  const [error, setError] = useState<string>('')
  const [showError, setShowError] = useState(false)
  const [decodedRedirectPath, setDecodedRedirectPath] = useState('/')
  const [magicLinkLogin, setMagicLinkLogin] = useState(true)

  const loginSchema = (magicLinkState: boolean) => {
    if (!magicLinkState) {
      return Yup.object().shape({
        usernameOrEmail: Yup.string().required(
          t('shared.generic.usernameError')
        ),
        password: Yup.string().required(t('shared.generic.passwordError')),
      })
    } else {
      return Yup.object().shape({
        usernameOrEmail: Yup.string().required(
          t('shared.generic.usernameError')
        ),
      })
    }
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(window?.location?.search)
    const redirectTo = urlParams?.get('redirect_to')
    if (redirectTo) {
      setDecodedRedirectPath(decodeURIComponent(redirectTo))
    }
  }, [])

  const loginWithPassword = async (
    values: any,
    { setSubmitting, resetForm }: any
  ) => {
    setError('')
    try {
      const result: FetchResult = await loginParticipant({
        variables: {
          usernameOrEmail: values.usernameOrEmail.trim(),
          password: values.password.trim(),
        },
      })

      if (!result.data?.loginParticipant) {
        setError(t('shared.generic.studentLoginError'))
        setShowError(true)
        setSubmitting(false)
        resetForm()
      } else {
        await fetchSelf()

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
        initialValues={{ usernameOrEmail: '', password: '' }}
        validationSchema={loginSchema(magicLinkLogin)}
        onSubmit={(values: any, { setSubmitting, resetForm }: any) => {
          if (magicLinkLogin) {
            // TODO implement logic
            console.log('magic link login')
          } else {
            loginWithPassword(values, { setSubmitting, resetForm })
          }
        }}
      >
        {({ isSubmitting }) => (
          <LoginForm
            labelIdentifier={t('shared.generic.usernameOrEmail')}
            fieldIdentifier="usernameOrEmail"
            dataIdentifier={{ cy: 'username-field' }}
            labelSecret={t('shared.generic.password')}
            fieldSecret="password"
            dataSecret={{ cy: 'password-field' }}
            isSubmitting={isSubmitting}
            installAndroid={t('pwa.login.installAndroid')}
            installIOS={t('pwa.login.installIOS')}
            magicLinkLogin={magicLinkLogin}
            setMagicLinkLogin={setMagicLinkLogin}
          />
        )}
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

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Login

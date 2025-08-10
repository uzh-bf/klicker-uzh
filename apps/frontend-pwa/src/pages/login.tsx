import { FetchResult, useLazyQuery, useMutation } from '@apollo/client'
import {
  LoginParticipantDocument,
  SelfDocument,
  SendMagicLinkDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import * as Yup from 'yup'
import LoginForm from '../components/forms/LoginForm'

function Login() {
  const t = useTranslations()
  const router = useRouter()

  // TODO: add query update
  const [loginParticipant] = useMutation(LoginParticipantDocument)
  // TODO: add query update
  const [sendMagicLink] = useMutation(SendMagicLinkDocument)
  const [fetchSelf] = useLazyQuery(SelfDocument, {
    fetchPolicy: 'network-only',
  })
  const [decodedRedirectPath, setDecodedRedirectPath] = useState('/')
  const [magicLinkLogin, setMagicLinkLogin] = useState(false)

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
    try {
      const result: FetchResult = await loginParticipant({
        variables: {
          usernameOrEmail: values.usernameOrEmail.trim(),
          password: values.password.trim(),
        },
      })

      if (!result.data?.loginParticipant) {
        toast({
          type: 'error',
          message: t('shared.generic.studentLoginError'),
          options: { duration: 6000 },
        })
        setSubmitting(false)
        resetForm()
      } else {
        await fetchSelf()

        // redirect to the specified redirect path (default: question pool)
        router.push(decodedRedirectPath)
      }
    } catch (e) {
      console.error(e)
      toast({
        type: 'error',
        message: t('shared.generic.systemError'),
        options: { duration: 6000 },
      })
      setSubmitting(false)
      resetForm()
    }
  }

  const sendMagicLinkEmail = async (values: any, { setSubmitting }: any) => {
    try {
      const result = await sendMagicLink({
        variables: {
          usernameOrEmail: values.usernameOrEmail.trim(),
        },
      })

      // show success message on success
      if (result.data?.sendMagicLink) {
        toast({
          type: 'success',
          message: t('pwa.general.magicLinkSent'),
          options: { duration: 8000 },
        })
        setSubmitting(false)
      }
    } catch (e) {
      console.error(e)
      toast({
        type: 'error',
        message: t('shared.generic.systemError'),
        options: { duration: 6000 },
      })
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full flex-col items-center md:justify-center">
      <Head>
        <title>Student Login</title>
        <meta
          name="description"
          content="Log in interface for students to access all Klicker activities for courses linked to their account."
        />
      </Head>
      <Formik
        initialValues={{ usernameOrEmail: '', password: '' }}
        validationSchema={loginSchema(magicLinkLogin)}
        onSubmit={(values: any, { setSubmitting, resetForm }: any) => {
          if (magicLinkLogin) {
            sendMagicLinkEmail(values, { setSubmitting })
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

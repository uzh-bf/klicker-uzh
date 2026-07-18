import { FetchResult, useLazyQuery, useMutation } from '@apollo/client'
import {
  LoginParticipantDocument,
  SelfDocument,
  SendMagicLinkDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as Yup from 'yup'
import LoginForm from '../components/forms/LoginForm'

interface LoginProps {
  redirectPath: string
}

function getSafeRedirectPath(
  value: string | string[] | undefined,
  pwaUrl: string,
  chatUrl: string | undefined
) {
  const redirectTo = Array.isArray(value) ? value[0] : value
  if (!redirectTo) return '/'

  try {
    const pwaOrigin = new URL(pwaUrl)
    const target = new URL(redirectTo, pwaOrigin)
    if (target.origin === pwaOrigin.origin) {
      return `${target.pathname}${target.search}${target.hash}`
    }

    if (chatUrl && target.origin === new URL(chatUrl).origin) {
      return target.toString()
    }

    return '/'
  } catch {
    return '/'
  }
}

function Login({ redirectPath }: Readonly<LoginProps>) {
  const t = useTranslations()
  const router = useRouter()

  const [loginParticipant] = useMutation(LoginParticipantDocument)
  const [sendMagicLink] = useMutation(SendMagicLinkDocument)
  const [fetchSelf] = useLazyQuery(SelfDocument, {
    fetchPolicy: 'network-only',
  })
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
        if (redirectPath.startsWith('/')) {
          void router.push(redirectPath)
        } else {
          window.location.assign(redirectPath)
        }
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

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const forwardedProto = ctx.req.headers['x-forwarded-proto']
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || 'https'
  const host = ctx.req.headers.host as string
  const requestBase = `${proto}://${host}`
  const configuredPwaUrl = process.env.NEXT_PUBLIC_PWA_URL
  const pwaUrl = configuredPwaUrl || requestBase
  const redirectPath = getSafeRedirectPath(
    ctx.query.redirect_to,
    pwaUrl,
    process.env.NEXT_PUBLIC_CHAT_URL
  )

  // In assessment mode, SSR-redirect to Auth /student to avoid client-side flash
  if (process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true') {
    if (!configuredPwaUrl) {
      throw new Error('NEXT_PUBLIC_PWA_URL is required in assessment mode')
    }
    const targetUrl = new URL(redirectPath, configuredPwaUrl).toString()
    const authBase =
      process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.klicker.uzh.ch'

    return {
      redirect: {
        destination: `${authBase}/student?redirectTo=${encodeURIComponent(targetUrl)}`,
        permanent: false,
      },
    }
  }

  // Non-assessment mode: render as usual with messages
  const locale = ctx.locale || ctx.defaultLocale || 'en'
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
      redirectPath,
    },
  }
}

export default Login

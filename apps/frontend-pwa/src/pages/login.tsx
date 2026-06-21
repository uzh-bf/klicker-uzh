import { trpc } from '@lib/trpc'
import { toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import * as Yup from 'yup'
import LoginForm from '../components/forms/LoginForm'

function getSafeRedirectPath(redirectPath: string) {
  if (!redirectPath.startsWith('/') || redirectPath.startsWith('//')) {
    return '/'
  }

  return redirectPath
}

function Login() {
  const t = useTranslations()
  const utils = trpc.useUtils()

  const loginParticipant = trpc.participant.login.useMutation()
  const sendMagicLink = trpc.participant.sendMagicLink.useMutation()
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
      try {
        setDecodedRedirectPath(
          getSafeRedirectPath(decodeURIComponent(redirectTo))
        )
      } catch {
        setDecodedRedirectPath('/')
      }
    }
  }, [])

  const loginWithPassword = async (
    values: any,
    { setSubmitting, resetForm }: any
  ) => {
    try {
      const participantId = await loginParticipant.mutateAsync({
        usernameOrEmail: values.usernameOrEmail.trim(),
        password: values.password.trim(),
      })

      if (!participantId) {
        toast({
          type: 'error',
          message: t('shared.generic.studentLoginError'),
          options: { duration: 6000 },
        })
        setSubmitting(false)
        resetForm()
      } else {
        await utils.participant.self.fetch(undefined)

        // redirect to the specified redirect path (default: question pool)
        window.location.assign(getSafeRedirectPath(decodedRedirectPath))
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
      const result = await sendMagicLink.mutateAsync({
        usernameOrEmail: values.usernameOrEmail.trim(),
      })

      // show success message on success
      if (result) {
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
  // In assessment mode, SSR-redirect to Auth /student to avoid client-side flash
  if (process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true') {
    const proto = (ctx.req.headers['x-forwarded-proto'] || 'https') as string
    const host = ctx.req.headers.host as string
    const base = `${proto}://${host}`

    const redirectParam = (ctx.query.redirect_to as string) || '/'
    const targetUrl = new URL(redirectParam, base).toString()
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
    },
  }
}

export default Login

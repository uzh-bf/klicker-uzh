import { FetchResult, useMutation } from '@apollo/client'
import {
  LoginParticipantDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import * as RadixLabel from '@radix-ui/react-label'
import {
  Button,
  H1,
  ThemeContext,
  UserNotification,
} from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useContext, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

interface BeforeInstallPromptEventReturn {
  userChoice: string
  platform: string
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<BeforeInstallPromptEventReturn>
}

function LoginForm() {
  const t = useTranslations()

  const router = useRouter()
  const theme = useContext(ThemeContext)

  const [loginParticipant] = useMutation(LoginParticipantDocument)
  const [error, setError] = useState<string>('')
  const [oniOS, setOniOS] = useState(false)
  const [onChrome, setOnChrome] = useState(false)
  const deferredPrompt = useRef<undefined | BeforeInstallPromptEvent>(undefined)

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

  useEffect(() => {
    // Check if event is supported
    if ('onbeforeinstallprompt' in window) {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault()
        deferredPrompt.current = e as BeforeInstallPromptEvent
        setOnChrome(true)
      })
    } else {
      // We assume users are on iOS (for now)
      setOniOS(true)
    }
  }, [])

  const onInstallClick = async () => {
    deferredPrompt.current!.prompt()
  }

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
      setSubmitting(false)
      resetForm()
    }
  }

  return (
    <div className="relative flex flex-col items-center justify-center w-screen h-screen pb-20">
      <Formik
        initialValues={{ username: '', password: '' }}
        validationSchema={loginSchema}
        onSubmit={onSubmit}
      >
        {({ errors, touched, isSubmitting }) => {
          return (
            <div className="">
              <div className="w-full mb-8 text-center sm:mb-12">
                <Image
                  src="/KlickerLogo.png"
                  width={300}
                  height={90}
                  alt="KlickerUZH Logo"
                  className="mx-auto"
                  data-cy="login-logo"
                />
              </div>
              <H1>{t('shared.generic.login')}</H1>
              <div className="mb-10">
                <Form className="w-72 sm:w-96">
                  <RadixLabel.Root
                    htmlFor="username"
                    className="text-sm leading-7 text-gray-600"
                  >
                    {t('shared.generic.username')}
                  </RadixLabel.Root>
                  <Field
                    name="username"
                    type="text"
                    className={twMerge(
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 mb-2',
                      theme.primaryBorderFocus,
                      errors.username &&
                        touched.username &&
                        'border-red-400 bg-red-50'
                    )}
                    data-cy="username-field"
                  />
                  <ErrorMessage
                    name="username"
                    component="div"
                    className="text-sm text-red-400"
                  />

                  <RadixLabel.Root
                    className="text-sm leading-7 text-gray-600"
                    htmlFor="password"
                  >
                    {t('shared.generic.password')}
                  </RadixLabel.Root>
                  <Field
                    name="password"
                    type="password"
                    className={twMerge(
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 mb-2',
                      theme.primaryBorderFocus,
                      touched.password && 'border-red-400 bg-red-50'
                    )}
                    data-cy="password-field"
                  />
                  <ErrorMessage
                    name="password"
                    component="div"
                    className="text-sm text-red-400"
                  />
                  {error && <UserNotification type="error" message={error} />}
                  <div className="flex justify-center mt-7">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className={{ root: 'mt-2 border-uzh-grey-80' }}
                      data={{ cy: 'submit-login' }}
                    >
                      <Button.Label>{t('shared.generic.signin')}</Button.Label>
                    </Button>
                  </div>
                  {onChrome && (
                    <div className="flex flex-col justify-center md:hidden mt-7">
                      <UserNotification
                        type="info"
                        message={t('pwa.login.installPWA')}
                      >
                        <Button
                          className={{
                            root: 'mt-2 w-fit border-uzh-grey-80',
                          }}
                          onClick={onInstallClick}
                        >
                          <Button.Label>
                            {t('pwa.login.installButton')}
                          </Button.Label>
                        </Button>
                      </UserNotification>
                    </div>
                  )}
                  {oniOS && (
                    <UserNotification
                      className={{ root: 'mt-4' }}
                      type="info"
                      message={t('pwa.login.installHomeScreen')}
                    />
                  )}
                </Form>
              </div>
            </div>
          )
        }}
      </Formik>
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

export default LoginForm

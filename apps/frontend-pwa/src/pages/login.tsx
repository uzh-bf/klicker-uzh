import { FetchResult, useMutation } from '@apollo/client'
import { LoginParticipantDocument } from '@klicker-uzh/graphql/dist/ops'
import * as RadixLabel from '@radix-ui/react-label'
import { Button, H1, UserNotification } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import Image from 'next/future/image'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

const loginSchema = Yup.object().shape({
  username: Yup.string().required('Enter your username'),
  password: Yup.string().required('Enter your password'),
})

interface BeforeInstallPromptEventReturn {
  userChoice: string
  platform: string
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<BeforeInstallPromptEventReturn>
}

function LoginForm() {
  const router = useRouter()

  const [loginParticipant] = useMutation(LoginParticipantDocument)
  const [error, setError] = useState<string>('')
  const [oniOS, setOniOS] = useState(false)
  const [onChrome, setOnChrome] = useState(false)
  const deferredPrompt = useRef<undefined | BeforeInstallPromptEvent>(undefined)

  const [decodedRedirectPath, setDecodedRedirectPath] = useState('/')

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
      })
      const userID: string | null = result.data!.loginParticipant
      if (!userID) {
        setError('Wrong username or password')
        setSubmitting(false)
        resetForm()
      } else {
        console.log('Login successful!', userID)

        // redirect to the specified redirect path (default: question pool)
        router.push(decodedRedirectPath)
      }
    } catch (e) {
      console.error(e)
      setError(
        'A problem occurred while signing you in. Please try again later.'
      )
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
                />
              </div>
              <H1>Login</H1>
              <div className="mb-10">
                <Form className="w-72 sm:w-96">
                  <RadixLabel.Root
                    htmlFor="username"
                    className="text-sm leading-7 text-gray-600"
                  >
                    Username
                  </RadixLabel.Root>
                  <Field
                    name="username"
                    type="text"
                    className={twMerge(
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 mb-2',
                      errors.username &&
                        touched.username &&
                        'border-red-400 bg-red-50'
                    )}
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
                    Passwort
                  </RadixLabel.Root>
                  <Field
                    name="password"
                    type="password"
                    className={twMerge(
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 mb-2',
                      touched.password && 'border-red-400 bg-red-50'
                    )}
                  />
                  <ErrorMessage
                    name="password"
                    component="div"
                    className="text-sm text-red-400"
                  />
                  {error && (
                    <UserNotification
                      notificationType="error"
                      message={error}
                    />
                  )}
                  <div className="flex justify-center mt-7">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="mt-2 border-uzh-grey-80"
                    >
                      <Button.Label>Anmelden</Button.Label>
                    </Button>
                  </div>
                  {onChrome && (
                    <div className="flex flex-col justify-center md:hidden mt-7">
                      <UserNotification
                        notificationType="info"
                        message="Installieren Sie die KlickerUZH App auf Ihrem Handy, um Push-Benachrichtigungen zu erhalten, wenn neue Lerninhalte verfügbar sind."
                      >
                        <Button
                          className="mt-2 w-fit border-uzh-grey-80"
                          onClick={onInstallClick}
                        >
                          <Button.Label>Jetzt installieren</Button.Label>
                        </Button>
                      </UserNotification>
                    </div>
                  )}
                  {oniOS && (
                    <UserNotification
                      notificationType="info"
                      message="Öffnen Sie den Share-Dialog und klicken Sie auf 'Zum Startbildschirm hinzufügen', um die Klicker App auf Ihrem Handy zu installieren."
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

export default LoginForm

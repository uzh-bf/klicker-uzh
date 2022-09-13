import { useMutation } from '@apollo/client'
import { LoginUserDocument } from '@klicker-uzh/graphql/dist/ops'
import * as RadixLabel from '@radix-ui/react-label'
import { Button, H1 } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import Router from 'next/router'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

import Footer from '../components/common/Footer'

const loginSchema = Yup.object().shape({
  email: Yup.string().required('Geben Sie eine gültige E-Mail Adresse ein'),
  password: Yup.string().required('Geben Sie Ihr Passwort ein'),
})

function LoginForm() {
  const [loginUser] = useMutation(LoginUserDocument)

  return (
    <div className="relative flex flex-col items-center justify-center w-screen h-screen pb-20">
      <Formik
        initialValues={{ email: '', password: '' }}
        validationSchema={loginSchema}
        onSubmit={async (values) => {
          await loginUser({
            variables: { email: values.email, password: values.password },
          })
          Router.push('/')
        }}
      >
        {({ errors, touched, isSubmitting }) => {
          return (
            <div className="">
              <H1>Login</H1>
              <div className="">
                <Form className="w-72 sm:w-96">
                  <RadixLabel.Root
                    htmlFor="email"
                    className="text-sm leading-7 text-gray-600"
                  >
                    E-Mail Adresse
                  </RadixLabel.Root>
                  <Field
                    name="email"
                    type="text"
                    className={twMerge(
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 mb-2',
                      errors.email &&
                        touched.email &&
                        'border-red-400 bg-red-50'
                    )}
                  />
                  <ErrorMessage
                    name="email"
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
                      errors.password &&
                        touched.password &&
                        'border-red-400 bg-red-50'
                    )}
                  />
                  <ErrorMessage
                    name="password"
                    component="div"
                    className="text-sm text-red-400"
                  />

                  <div className="flex flex-row justify-between">
                    <div className="flex flex-col text-sm">
                      {/* // TODO: Implement password reset and registration
                      <Link href="/requestPassword">
                        <div className="text-uzh-blue-60 hover:text-uzh-blue-80">
                          Passwort vergessen?
                        </div>
                      </Link>
                      <Link href="/registration">
                        <div className="text-uzh-blue-60 hover:text-uzh-blue-80">
                          Neu registrieren
                        </div>
                      </Link> */}
                    </div>
                    <Button
                      className="mt-2 border-uzh-grey-80"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      <Button.Label>Anmelden</Button.Label>
                    </Button>
                  </div>
                </Form>
              </div>
            </div>
          )
        }}
      </Formik>
      <Footer />
    </div>
  )
}

export default LoginForm

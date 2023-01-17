import { useMutation } from '@apollo/client'
import { LoginUserDocument } from '@klicker-uzh/graphql/dist/ops'
import * as RadixLabel from '@radix-ui/react-label'
import { Button, H1, ThemeContext } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import Image from 'next/image'
import Router from 'next/router'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

const loginSchema = Yup.object().shape({
  email: Yup.string().required('Geben Sie eine gültige E-Mail Adresse ein'),
  password: Yup.string().required('Geben Sie Ihr Passwort ein'),
})

function LoginForm() {
  const theme = useContext(ThemeContext)
  const [loginUser] = useMutation(LoginUserDocument)

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full pb-20 mx-auto">
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
            <div>
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
              <H1>Login Controller-App</H1>
              <div className="mb-10">
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
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 mb-2',
                      theme.primaryBorderFocus,
                      errors.email &&
                        touched.email &&
                        'border-red-400 bg-red-50'
                    )}
                    data-cy="email-field"
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
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 mb-2',
                      theme.primaryBorderFocus,
                      errors.password &&
                        touched.password &&
                        'border-red-400 bg-red-50'
                    )}
                    data-cy="password-field"
                  />
                  <ErrorMessage
                    name="password"
                    component="div"
                    className="text-sm text-red-400"
                  />

                  <div className="flex flex-row justify-between">
                    <div className="flex flex-col text-sm"></div>
                    <Button
                      className={{ root: 'mt-2 border-uzh-grey-80' }}
                      type="submit"
                      disabled={isSubmitting}
                      data={{ cy: 'submit-login' }}
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
      <footer
        className={'absolute bottom-0 w-full bg-slate-100 print:hidden px-4'}
      >
        <hr className="h-[1px] border-0 bg-gradient-to-r from-transparent via-gray-500 to-transparent" />
        <p className="py-4 m-0 text-xs leading-5 text-center text-gray-400">
          &copy;
          {new Date().getFullYear()} IBF Teaching Center, Department of Banking
          and Finance, University of Zurich. All rights reserved.
          <br />
          Products and Services displayed herein are trademarks or registered
          trademarks of their respective owners.
        </p>
      </footer>
    </div>
  )
}

export default LoginForm

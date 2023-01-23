import { useMutation } from '@apollo/client'
import { LoginUserTokenDocument } from '@klicker-uzh/graphql/dist/ops'
import * as RadixLabel from '@radix-ui/react-label'
import {
  Button,
  H1,
  ThemeContext,
  UserNotification,
} from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import Image from 'next/image'
import Router from 'next/router'
import { useContext, useState } from 'react'
import PinField from 'shared-components/src/PinField'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

const loginSchema = Yup.object().shape({
  email: Yup.string().required('Geben Sie eine gültige E-Mail Adresse ein'),
  token: Yup.string().required(
    'Geben Sie einen gültigen Token ein. Bitte beachten Sie die bei der Token Generierung angezeigte Gültigkeit.'
  ),
})

function LoginForm() {
  const theme = useContext(ThemeContext)
  const [loginFailed, setLoginFailed] = useState(false)

  const [loginUserToken] = useMutation(LoginUserTokenDocument)

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full pb-20 mx-auto">
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
            setLoginFailed(true)
            return
          }
          Router.push('/')
        }}
      >
        {({
          errors,
          touched,
          values,
          setFieldValue,
          isSubmitting,
          isValid,
        }) => {
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
              <H1>Login Controller-App (Token)</H1>
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
                    htmlFor="token"
                  >
                    Token
                  </RadixLabel.Root>
                  <PinField
                    name="token"
                    error={errors.token}
                    touched={touched.token}
                    value={values.token}
                    setFieldValue={setFieldValue}
                    data-cy="token-field"
                  />

                  <div className="flex flex-row justify-between">
                    <div className="flex flex-col text-sm"></div>
                    <Button
                      className={{ root: 'mt-2 border-uzh-grey-80' }}
                      type="submit"
                      disabled={isSubmitting || !isValid}
                      data={{ cy: 'submit-login' }}
                    >
                      <Button.Label>Anmelden</Button.Label>
                    </Button>
                  </div>
                </Form>
              </div>
              {loginFailed && (
                <UserNotification
                  className={{ root: 'w-72 sm:w-96' }}
                  notificationType="error"
                  message="Login fehlgeschlagen. Bitte überprüfen Sie Ihre E-Mail Adresse und den Token. Beachten Sie die zeitlich begrenzte Gültigkeit des Tokens."
                />
              )}
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

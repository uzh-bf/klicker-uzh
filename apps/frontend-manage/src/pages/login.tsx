import { useMutation } from '@apollo/client'
import { faEye, faEyeSlash } from '@fortawesome/free-regular-svg-icons'
import { LoginUserDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextField, H1 } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import Image from 'next/image'
import Router from 'next/router'
import { useState } from 'react'
import * as Yup from 'yup'

import Footer from '../components/common/Footer'

const loginSchema = Yup.object().shape({
  email: Yup.string().required('Geben Sie eine gültige E-Mail Adresse ein'),
  password: Yup.string().required('Geben Sie Ihr Passwort ein'),
})

function LoginForm() {
  const [loginUser] = useMutation(LoginUserDocument)
  const [passwordHidden, setPasswordHidden] = useState(true)

  return (
    <div className="flex flex-col items-center h-full md:justify-center">
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
        {({ isSubmitting }) => {
          return (
            <div className="max-w-xl md:border md:rounded-lg md:shadow">
              <div className="flex flex-col items-center p-12">
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
                <div>
                  <H1>Login</H1>
                  <Form className="w-72 sm:w-96">
                    <FormikTextField
                      required
                      label="E-Mail Adresse"
                      labelType="small"
                      name="email"
                      data={{ cy: 'email-field' }}
                    />

                    <FormikTextField
                      required
                      label="Passwort"
                      labelType="small"
                      name="password"
                      data={{ cy: 'password-field' }}
                      icon={passwordHidden ? faEye : faEyeSlash}
                      onIconClick={() => setPasswordHidden(!passwordHidden)}
                      className={{ root: 'mt-1' }}
                      type={passwordHidden ? 'password' : 'text'}
                    />

                    <div className="flex flex-row justify-between">
                      <div className="flex flex-col text-sm">
                        {/* // TODO: Implement password reset and registration
                      <Link href="/requestPassword">
                        <div className="">
                          Passwort vergessen?
                        </div>
                      </Link>
                      <Link href="/registration">
                        <div className="">
                          Neu registrieren
                        </div>
                      </Link> */}
                      </div>
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
              <div className="flex-none w-full">
                <Footer />
              </div>
            </div>
          )
        }}
      </Formik>
    </div>
  )
}

export default LoginForm

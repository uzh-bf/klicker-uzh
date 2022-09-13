import { useMutation } from '@apollo/client'
import { LoginUserDocument } from '@klicker-uzh/graphql/dist/ops'
import * as RadixLabel from '@radix-ui/react-label'
import { Button, H1 } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import Router from 'next/router'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

const loginSchema = Yup.object().shape({
  email: Yup.string().required('Enter your username'),
  password: Yup.string().required('Enter your password'),
})

function LoginForm() {
  const [loginUser] = useMutation(LoginUserDocument)

  return (
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
          <div className="flex flex-col items-center justify-center w-full h-full">
            <H1>Sign in</H1>
            <Form className="w-40 sm:w-64">
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
                  'w-full px-3 py-1 text-base leading-8 text-gray-700 transition-colors',
                  'duration-200 ease-in-out bg-gray-100 bg-opacity-50 border border-gray-300',
                  'rounded outline-none focus:ring-2 focus:bg-transparent focus:ring-indigo-200 focus:border-indigo-500',
                  errors.email && touched.email && 'border-red-400 bg-red-50'
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
                Password
              </RadixLabel.Root>
              <Field
                name="password"
                type="password"
                className={twMerge(
                  'w-full px-3 py-1 text-base leading-8 text-gray-700 transition-colors',
                  'duration-200 ease-in-out bg-gray-100 bg-opacity-50 border border-gray-300',
                  'rounded outline-none focus:ring-2 focus:bg-transparent focus:ring-indigo-200 focus:border-indigo-500',
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

              <div className="flex justify-center mt-7">
                <Button active type="submit" disabled={isSubmitting}>
                  Submit
                </Button>
              </div>
            </Form>
          </div>
        )
      }}
    </Formik>
  )
}

export default LoginForm

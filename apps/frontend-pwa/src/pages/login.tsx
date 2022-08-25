import { useMutation } from '@apollo/client'
import { faArrowRightToBracket } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { LoginParticipantDocument } from '@klicker-uzh/graphql/dist/ops'
import * as RadixLabel from '@radix-ui/react-label'
import { Button, H1 } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

const loginSchema = Yup.object().shape({
  username: Yup.string().required('Enter your username'),
  password: Yup.string().required('Enter your password'),
})

function LoginForm() {
  const [loginParticipant] = useMutation(LoginParticipantDocument)

  const onSubmit = async (values: any, { setSubmitting, resetForm }: any) => {
    await loginParticipant({
      variables: { username: values.username, password: values.password },
    })
    setSubmitting(false)
    resetForm()
  }
  return (
    <Formik
      initialValues={{ username: '', password: '' }}
      validationSchema={loginSchema}
      onSubmit={onSubmit}
    >
      {({ errors, touched, isSubmitting }) => {
        return (
          <div className="flex flex-col items-center justify-center w-full h-full">
            <H1>Sign in</H1>
            <Form className="w-40 sm:w-64">
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
                  'w-full px-3 py-1 text-base leading-8 text-gray-700 transition-colors',
                  'duration-200 ease-in-out bg-gray-100 bg-opacity-50 border border-gray-300',
                  'rounded outline-none focus:ring-2 focus:bg-transparent focus:ring-indigo-200 focus:border-indigo-500',
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
                  <Button.Icon>
                    <FontAwesomeIcon icon={faArrowRightToBracket} />
                  </Button.Icon>
                  <Button.Label>Submit</Button.Label>
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

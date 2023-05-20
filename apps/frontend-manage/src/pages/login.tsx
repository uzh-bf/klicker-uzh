import { useMutation } from '@apollo/client'
import { LoginUserDocument } from '@klicker-uzh/graphql/dist/ops'
import { Formik } from 'formik'
import { useRouter } from 'next/router'
import LoginForm from 'shared-components/src/LoginForm'
import * as Yup from 'yup'

const loginSchema = Yup.object().shape({
  email: Yup.string().required('Geben Sie eine gültige E-Mail Adresse ein'),
  password: Yup.string().required('Geben Sie Ihr Passwort ein'),
})

function Login() {
  const [loginUser] = useMutation(LoginUserDocument)
  const router = useRouter()

  return (
    <div className="flex flex-col items-center h-full md:justify-center">
      <Formik
        initialValues={{ email: '', password: '' }}
        validationSchema={loginSchema}
        onSubmit={async (values) => {
          await loginUser({
            variables: { email: values.email, password: values.password },
          })
          router.push('/')
        }}
      >
        {({ isSubmitting }) => {
          return (
            <LoginForm
              header="Login Dozierende"
              label1="E-Mail Adresse"
              field1="email"
              data1={{ cy: 'email-field' }}
              label2="Passwort"
              field2="password"
              data2={{ cy: 'password-field' }}
              isSubmitting={isSubmitting}
              // TODO: after conversion to PWA, set this to true
              installationHint={false}
            />
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

export default Login

import { useMutation } from '@apollo/client'
import { LoginUserDocument, SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import { Toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import LoginForm from 'shared-components/src/LoginForm'
import * as Yup from 'yup'

const loginSchema = Yup.object().shape({
  email: Yup.string().required('Geben Sie eine gültige E-Mail Adresse ein'),
  password: Yup.string().required('Geben Sie Ihr Passwort ein'),
})

function Login() {
  const [loginUser] = useMutation(LoginUserDocument)
  const router = useRouter()
  const t = useTranslations()

  const [error, setError] = useState('')
  const [showError, setShowError] = useState(false)

  return (
    <div className="flex flex-col items-center h-full md:justify-center">
      <Formik
        initialValues={{ email: '', password: '' }}
        validationSchema={loginSchema}
        onSubmit={async (values, { setSubmitting, resetForm }: any) => {
          try {
            const result = await loginUser({
              variables: { email: values.email, password: values.password },
              refetchQueries: [SelfDocument],
            })
            const userID = result.data?.loginUser
            if (!userID) {
              setError(t('shared.generic.loginError'))
              setShowError(true)
              setSubmitting(false)
              resetForm()
            } else {
              console.log('Login successful!', userID)

              // TODO: enable push to redirected path (as for frontend-pwa)
              router.push('/')
            }
          } catch (e) {
            console.error(e)
            setError(t('shared.generic.systemError'))
            setShowError(true)
            setSubmitting(false)
            resetForm()
          }
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
      <Toast
        type="error"
        duration={6000}
        openExternal={showError}
        setOpenExternal={setShowError}
      >
        {error}
      </Toast>
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

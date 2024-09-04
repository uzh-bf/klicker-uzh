import { useMutation } from '@apollo/client'
import { LoginUserTokenDocument } from '@klicker-uzh/graphql/dist/ops'
import { Toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Router from 'next/router'
import { useState } from 'react'
import * as Yup from 'yup'
import LoginForm from '../components/common/LoginForm'

function Login() {
  const t = useTranslations()
  const [error, setError] = useState('')
  const [showError, setShowError] = useState(false)
  const [loginUserToken] = useMutation(LoginUserTokenDocument)

  const loginSchema = Yup.object().shape({
    shortname: Yup.string().required(t('control.login.shortnameRequired')),
    token: Yup.string().required(t('control.login.tokenRequired')),
  })

  return (
    <div className="flex h-full flex-col items-center md:justify-center">
      <Formik
        isInitialValid={false}
        initialValues={{ shortname: '', token: '' }}
        validationSchema={loginSchema}
        onSubmit={async (values) => {
          const id = await loginUserToken({
            variables: {
              shortname: values.shortname.trim(),
              token: values.token.replace(/\s/g, ''),
            },
          })
          if (id.data?.loginUserToken === null) {
            setError(t('control.login.checkToken'))
            setShowError(true)
            return
          }
          Router.push('/')
        }}
      >
        {({ isSubmitting }) => {
          return (
            <LoginForm
              header={t('control.login.header')}
              labelIdentifier={t('shared.generic.shortname')}
              fieldIdentifier="shortname"
              dataIdentifier={{ cy: 'shortname-field' }}
              labelSecret={t('shared.generic.token')}
              fieldSecret="token"
              dataSecret={{ cy: 'token-field' }}
              isSubmitting={isSubmitting}
              installAndroid={t('control.login.installAndroid')}
              installIOS={t('control.login.installIOS')}
            />
          )
        }}
      </Formik>
      <Toast
        dismissible
        type="error"
        duration={6000}
        openExternal={showError}
        setOpenExternal={setShowError}
        className={{ root: 'max-w-[30rem]' }}
      >
        {error}
      </Toast>
    </div>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Login

import { useLazyQuery, useMutation } from '@apollo/client'
import {
  LoginParticipantMagicLinkDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, Toast } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'

function MagicLogin() {
  const router = useRouter()
  const t = useTranslations()
  const loginTimeout = useRef<any>()
  const redirectionTimeout = useRef<any>()
  const { token, username } = router.query

  const [loginWithMagicLink] = useMutation(LoginParticipantMagicLinkDocument)
  const [fetchSelf] = useLazyQuery(SelfDocument, {
    fetchPolicy: 'network-only',
  })
  const [showError, setShowError] = useState(false)

  // set timeout of 2 seconds to show the loader and then login in timeout callback
  useEffect(() => {
    if (token) {
      clearTimeout(loginTimeout.current)
      clearTimeout(redirectionTimeout.current)
      loginTimeout.current = setTimeout(async () => {
        const result = await loginWithMagicLink({
          variables: {
            token: token as string,
          },
        })

        if (result?.data?.loginParticipantMagicLink) {
          clearTimeout(loginTimeout.current)
          clearTimeout(redirectionTimeout.current)
          await fetchSelf()
          router.push('/')
        } else {
          setShowError(true)
          redirectionTimeout.current = setTimeout(() => {
            router.push('/login')
          }, 5000)
        }
      }, 1500)
    }

    return () => {
      clearTimeout(loginTimeout.current)
      clearTimeout(redirectionTimeout.current)
    }
  }, [router.query.token])

  return (
    <div className="m-auto">
      <Image
        src="/KlickerLogo.png"
        width={300}
        height={90}
        alt="KlickerUZH Logo"
        className="mx-auto"
        data-cy="login-logo"
      />
      <H2 className={{ root: 'mb-2 mt-4' }}>
        {t('pwa.general.processingLogin')}
      </H2>
      <Loader />
      <Toast
        type="error"
        duration={8000}
        openExternal={showError}
        setOpenExternal={setShowError}
      >
        {t('pwa.general.magicLinkLoginFailed')}
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

export default MagicLogin

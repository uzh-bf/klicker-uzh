import Loader from '@klicker-uzh/shared-components/src/Loader'
import { trpc } from '@lib/trpc'
import { H2, UserNotification, toast } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'

function Activation() {
  const router = useRouter()
  const t = useTranslations()
  const loginTimeout = useRef<any>(null)
  const redirectionTimeout = useRef<any>(null)
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  const token =
    typeof router.query.token === 'string' && router.query.token.trim() !== ''
      ? router.query.token
      : undefined
  const utils = trpc.useUtils()

  const activateAccount = trpc.participant.activateAccount.useMutation()

  // set timeout of 2 seconds to show the loader and then login in timeout callback
  useEffect(() => {
    if (!router.isReady) return

    clearTimeout(loginTimeout.current)
    clearTimeout(redirectionTimeout.current)
    setFailureMessage(null)

    const redirectToLogin = () => {
      redirectionTimeout.current = setTimeout(() => {
        void router
          .push('/login')
          .then((routed) => {
            if (!routed) window.location.assign('/login')
          })
          .catch(console.error)
      }, 5000)
    }

    const showFailure = () => {
      const message = t('pwa.general.accountActivationFailed')
      setFailureMessage(message)
      toast({
        type: 'error',
        message,
        options: { duration: 8000 },
      })
      redirectToLogin()
    }

    if (!token) {
      showFailure()
      return
    }

    loginTimeout.current = setTimeout(async () => {
      try {
        const result = await activateAccount.mutateAsync({ token })

        if (result) {
          clearTimeout(loginTimeout.current)
          clearTimeout(redirectionTimeout.current)
          await utils.participant.self.fetch(undefined).catch(console.error)
          const routed = await router.push('/')
          if (!routed) window.location.assign('/')
        } else {
          showFailure()
        }
      } catch (error) {
        console.error(error)
        showFailure()
      }
    }, 1500)

    return () => {
      clearTimeout(loginTimeout.current)
      clearTimeout(redirectionTimeout.current)
    }
  }, [router.isReady, token])

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
      {failureMessage ? (
        <UserNotification
          type="error"
          message={failureMessage}
          className={{ root: 'mt-4 max-w-md text-base' }}
        />
      ) : (
        <>
          <H2 className={{ root: 'mb-2 mt-4' }}>
            {t('pwa.general.processingActivation')}
          </H2>
          <Loader />
        </>
      )}
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

export default Activation

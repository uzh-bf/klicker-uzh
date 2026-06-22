import Loader from '@klicker-uzh/shared-components/src/Loader'
import { trpc } from '@lib/trpc'
import { H2, toast } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'

function MagicLogin() {
  const router = useRouter()
  const t = useTranslations()
  const loginTimeout = useRef<any>(null)
  const redirectionTimeout = useRef<any>(null)
  const token =
    typeof router.query.token === 'string' && router.query.token.trim() !== ''
      ? router.query.token
      : undefined
  const utils = trpc.useUtils()

  const loginWithMagicLink = trpc.participant.loginWithMagicLink.useMutation()

  // set timeout of 2 seconds to show the loader and then login in timeout callback
  useEffect(() => {
    if (!router.isReady) return

    clearTimeout(loginTimeout.current)
    clearTimeout(redirectionTimeout.current)

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

    if (!token) {
      toast({
        type: 'error',
        message: t('pwa.general.magicLinkLoginFailed'),
        options: { duration: 8000 },
      })

      redirectToLogin()
      return
    }

    loginTimeout.current = setTimeout(async () => {
      try {
        const result = await loginWithMagicLink.mutateAsync({ token })

        if (result) {
          clearTimeout(loginTimeout.current)
          clearTimeout(redirectionTimeout.current)
          await utils.participant.self.fetch(undefined).catch(console.error)
          const routed = await router.push('/')
          if (!routed) window.location.assign('/')
        } else {
          toast({
            type: 'error',
            message: t('pwa.general.magicLinkLoginFailed'),
            options: { duration: 8000 },
          })

          redirectToLogin()
        }
      } catch (error) {
        console.error(error)
        toast({
          type: 'error',
          message: t('pwa.general.magicLinkLoginFailed'),
          options: { duration: 8000 },
        })

        redirectToLogin()
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
      <H2 className={{ root: 'mb-2 mt-4' }}>
        {t('pwa.general.processingLogin')}
      </H2>
      <Loader />
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

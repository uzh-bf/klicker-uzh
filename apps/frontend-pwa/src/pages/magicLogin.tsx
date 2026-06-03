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
  const { token } = router.query
  const utils = trpc.useUtils()

  const loginWithMagicLink = trpc.participant.loginWithMagicLink.useMutation()

  // set timeout of 2 seconds to show the loader and then login in timeout callback
  useEffect(() => {
    if (token) {
      clearTimeout(loginTimeout.current)
      clearTimeout(redirectionTimeout.current)
      loginTimeout.current = setTimeout(async () => {
        const result = await loginWithMagicLink.mutateAsync({
          token: token as string,
        })

        if (result) {
          clearTimeout(loginTimeout.current)
          clearTimeout(redirectionTimeout.current)
          await utils.participant.self.fetch(undefined)
          router.push('/')
        } else {
          toast({
            type: 'error',
            message: t('pwa.general.magicLinkLoginFailed'),
            options: { duration: 8000 },
          })

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

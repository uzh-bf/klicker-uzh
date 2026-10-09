import {
  faArrowsRotate,
  faExclamationCircle,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { participantDataUseReturn } from '@lib/participantDataUseReturn'
import { Button, H1 } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

function Index() {
  const t = useTranslations()
  const router = useRouter()
  const [embedded, setEmbedded] = useState(false)
  const freshLaunch = router.query.freshLaunch === 'true'

  // Frame detection only selects recovery guidance; it never grants identity.
  useEffect(() => {
    setEmbedded(window.self !== window.top)
  }, [])

  const retry = () => {
    // The shared helper rejects cross-origin destinations and strips
    // credential parameters before the retry navigates.
    const redirectTo = router.query.redirectTo
    const destination =
      typeof redirectTo === 'string'
        ? participantDataUseReturn(redirectTo, window.location.origin)
        : '/'
    void router.push(destination)
  }

  return (
    <Layout displayName={t('shared.generic.title')}>
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="flex flex-row items-center gap-4 text-red-600">
          <FontAwesomeIcon icon={faExclamationCircle} size="3x" />
          <H1 className={{ root: 'mb-0' }}>{t('pwa.serverError.warning')}</H1>
        </div>
        {!router.isReady ? (
          <Loader />
        ) : freshLaunch ? (
          <div data-cy="fresh-launch-recovery">
            <p className="max-w-140 my-4 text-gray-600">
              {t('pwa.serverError.freshLaunchRecovery')}
            </p>
            {embedded ? (
              <p className="max-w-140 text-gray-600">
                {t('pwa.serverError.freshLaunchRecoveryEmbedded')}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <p className="max-w-140 my-4 text-gray-600">
              {t('pwa.serverError.serverSideError')}
            </p>
            <Button onClick={retry} className={{ root: 'h-8' }}>
              <Button.Icon icon={faArrowsRotate} />
              <Button.Label>{t('pwa.serverError.tryAgain')}</Button.Label>
            </Button>
          </>
        )}
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Index

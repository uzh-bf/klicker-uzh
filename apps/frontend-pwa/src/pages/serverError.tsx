import {
  faArrowsRotate,
  faExclamationCircle,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H1 } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'

function Index() {
  const t = useTranslations()
  const router = useRouter()

  return (
    <Layout displayName={t('shared.generic.title')}>
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="flex flex-row items-center gap-4 text-red-600">
          <FontAwesomeIcon icon={faExclamationCircle} size="3x" />
          <H1 className={{ root: 'mb-0' }}>{t('pwa.serverError.warning')}</H1>
        </div>
        <p className="max-w-140 my-4 text-gray-600">
          {t('pwa.serverError.serverSideError')}
        </p>
        <Button
          onClick={() => {
            // redirect to page in query parameter, if defined
            const redirectTo = router.query.redirectTo
            if (
              redirectTo &&
              typeof redirectTo === 'string' &&
              redirectTo.startsWith('/') &&
              !redirectTo.startsWith('//') && // prevent protocol-relative
              !redirectTo.includes('://') // prevent absolute URLs
            ) {
              router.push(redirectTo)
            } else {
              // fallback, navigate to home page
              router.push('/')
            }
          }}
          className={{ root: 'h-8' }}
        >
          <Button.Icon icon={faArrowsRotate} />
          <Button.Label>{t('pwa.serverError.tryAgain')}</Button.Label>
        </Button>
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

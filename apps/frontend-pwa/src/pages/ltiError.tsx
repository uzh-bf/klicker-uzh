import {
  faArrowsRotate,
  faExclamationCircle,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H1 } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import nookies from 'nookies'
import Layout from '../components/Layout'

function Index() {
  const t = useTranslations()
  const router = useRouter()

  return (
    <Layout displayName={t('shared.generic.title')}>
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="flex flex-row items-center gap-4 text-red-600">
          <FontAwesomeIcon icon={faExclamationCircle} size="3x" />
          <H1 className={{ root: 'mb-0' }}>{t('pwa.lti.loginFailedTitle')}</H1>
        </div>
        <p className="max-w-120 my-4 text-gray-600">
          {t('pwa.lti.loginFailedDescription')}
        </p>
        <Button
          onClick={() => {
            // TODO: remove this branch before merging, if the approach does not work to reset the lti token cookie
            // reset cookies
            nookies.destroy(null, 'lti-token', {
              domain: process.env.COOKIE_DOMAIN,
              path: '/',
            })

            // redirect to page in query parameter, if defined
            if (
              router.query.redirectTo &&
              typeof router.query.redirectTo === 'string'
            ) {
              router.push(router.query.redirectTo)
            }
          }}
          className={{ root: 'h-8' }}
        >
          <Button.Icon icon={faArrowsRotate} />
          <Button.Label>{t('pwa.lti.tryAgain')}</Button.Label>
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

// TODO: remove
// https://pwa.klicker.com/ltiError?redirectTo=https://pwa.klicker.com/createAccount

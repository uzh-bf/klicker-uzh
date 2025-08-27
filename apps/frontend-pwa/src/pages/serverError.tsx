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
          <H1 className={{ root: 'mb-0' }}>{t('pwa.serverError.warning')}</H1>
        </div>
        <p className="max-w-140 my-4 text-gray-600">
          {t('pwa.serverError.serverSideError')}
        </p>
        <Button
          onClick={() => {
            // TODO: remove this, if it does not work as desired
            // reset lti-token cookie that can create issues with authentication
            nookies.destroy(null, 'lti-token', {
              domain: process.env.COOKIE_DOMAIN,
              path: '/',
            })

            // TODO: remove - test code to determine if cookies can be removed through client
            nookies.destroy(null, 'lti-tokenv2', {
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

// TODO: remove
// https://pwa.klicker.com/serverError?redirectTo=https://pwa.klicker.com/createAccount

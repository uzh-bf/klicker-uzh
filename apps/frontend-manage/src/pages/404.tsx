import { faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Layout from '../components/Layout'

function MissingPage() {
  const t = useTranslations()

  return (
    <Layout displayName="KlickerUZH">
      <div className="mt-10 flex flex-col items-center gap-4 text-center">
        <div className="flex flex-row items-center gap-4 text-2xl text-red-600 sm:gap-6 sm:text-3xl md:gap-8 md:text-4xl">
          <FontAwesomeIcon icon={faBan} className="sm:h-18 h-14 md:h-20" />
          <div>{t('shared.error.404')}</div>
        </div>
        <div className="max-w-[90%] sm:max-w-[70%] md:max-w-[35rem]">
          {t.rich('manage.general.404Message', {
            link: (linkText) => (
              <Link
                href="/"
                className="text-uzh-blue-60 hover:text-uzh-blue-100"
                legacyBehavior
                passHref
              >
                <a data-cy="404-home-link">{linkText}</a>
              </Link>
            ),
          })}
        </div>
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

export default MissingPage

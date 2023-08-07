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
      <div className="flex flex-col items-center gap-4 mt-10 text-center">
        <div className="flex flex-row items-center gap-4 text-2xl text-red-600 sm:gap-6 md:gap-8 sm:text-3xl md:text-4xl">
          <FontAwesomeIcon icon={faBan} className="h-14 sm:h-18 md:h-20" />
          <div>{t('shared.error.404')}</div>
        </div>
        <div className="max-w-[90%] sm:max-w-[70%] md:max-w-[35rem]">
          {t.rich('manage.general.404Message', {
            link: (linkText) => (
              <Link
                href="/"
                className="text-uzh-blue-60 sm:hover:text-uzh-blue-100"
              >
                {linkText}
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
      messages: (
        await import(
          `@klicker-uzh/shared-components/src/intl-messages/${locale}.json`
        )
      ).default,
    },
  }
}

export default MissingPage

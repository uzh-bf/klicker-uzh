import { useQuery } from '@apollo/client'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Layout from '../components/Layout'

function MissingPage() {
  const t = useTranslations()
  const { data: dataParticipant } = useQuery(SelfDocument)

  return (
    <Layout className="h-full">
      <div className="flex flex-col items-center gap-6 mx-auto my-auto text-center">
        <div className="flex flex-row items-center gap-4 text-2xl text-red-600 sm:gap-6 md:gap-8 sm:text-3xl md:text-4xl">
          <FontAwesomeIcon icon={faBan} className="h-14 sm:h-18 md:h-20" />
          <div>{t('shared.error.404')}</div>
        </div>
        {!dataParticipant?.self && (
          <div className="max-w-[90%] sm:max-w-[70%] md:max-w-[35rem]">
            {t.rich('shared.error.pwaWithoutUser', {
              login: (text) => (
                <Link
                  href="/login"
                  className="text-uzh-blue-60 hover:text-uzh-blue-100"
                >
                  {text}
                </Link>
              ),
            })}
          </div>
        )}
        {dataParticipant?.self && (
          <div className="max-w-[90%] sm:max-w-[70%] md:max-w-[35rem]">
            {t.rich('shared.error.pwaWithUser', {
              home: (text) => (
                <Link
                  href="/"
                  className="text-uzh-blue-60 hover:text-uzh-blue-100"
                >
                  {text}
                </Link>
              ),
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default MissingPage

import { useQuery } from '@apollo/client'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import Link from 'next/link'
import Layout from '../components/Layout'

function MissingPage() {
  const { data: dataParticipant } = useQuery(SelfDocument)

  console.log(dataParticipant)

  return (
    <Layout className="h-full">
      <div className="flex flex-col items-center gap-6 mx-auto my-auto text-center">
        <div className="flex flex-row items-center gap-4 text-2xl text-red-600 sm:gap-6 md:gap-8 sm:text-3xl md:text-4xl">
          <FontAwesomeIcon icon={faBan} className="h-14 sm:h-18 md:h-20" />
          <div>404 Page not found</div>
        </div>
        {!dataParticipant?.self && (
          <div className="max-w-[90%] sm:max-w-[70%] md:max-w-[35rem]">
            Die von Ihnen aufgerufene Seite existiert leider nicht. Sie können
            sich{' '}
            <Link
              href="/login"
              className="text-uzh-blue-60 hover:text-uzh-blue-100"
            >
              anmelden
            </Link>
            , um eine Übersicht aller Klicker-Elemente Ihrer Kurse zu sehen.
          </div>
        )}
        {dataParticipant?.self && (
          <div className="max-w-[90%] sm:max-w-[70%] md:max-w-[35rem]">
            Die von Ihnen aufgerufene Seite existiert leider nicht. Sehen Sie
            sich eine{' '}
            <Link href="/" className="text-uzh-blue-60 hover:text-uzh-blue-100">
              Übersicht
            </Link>{' '}
            aller Klicker-Elemente Ihrer Kurse an.
          </div>
        )}
      </div>
    </Layout>
  )
}

export default MissingPage

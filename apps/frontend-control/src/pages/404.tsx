import { faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import Layout from '../components/Layout'

function MissingPage() {
  return (
    <Layout title="KlickerUZH">
      <div className="mt-10 flex flex-col items-center gap-4 text-center">
        <div className="flex flex-row items-center gap-4 text-2xl text-red-600 sm:gap-6 sm:text-3xl md:gap-8 md:text-4xl">
          <FontAwesomeIcon icon={faBan} className="sm:h-18 h-14 md:h-20" />
          <div>404 Page not found</div>
        </div>
        <div className="max-w-[90%] sm:max-w-[70%] md:max-w-[35rem]">
          Die von Ihnen aufgerufene Seite existiert leider nicht. Kehren sie zum{' '}
          <Link
            href="/"
            className="text-uzh-blue-60 hover:text-uzh-blue-100"
            legacyBehavior
            passHref
          >
            <a data-cy="link-404-home">Fragepool</a>
          </Link>{' '}
          zurück oder nutzen sie das Menu zur weiteren Navigation.
        </div>
      </div>
    </Layout>
  )
}

export default MissingPage

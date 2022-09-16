import Link from 'next/link'

function MissingPage() {
  return (
    <div className="flex flex-col justify-center w-full h-full p-4 text-center bg-white md:rounded-lg md:border-2 md:border-solid md:border-uzh-blue-40">
      <div className="max-w-full px-8 py-3 m-auto bg-red-200 border border-red-600 border-solid rounded-lg">
        <div>Error 404: There is nothing to see here</div>
        {/* {dataParticipant ? (
      <div>
        Sehen Sie sich eine{' '}
        <Link href="/">
          <a className="text-uzh-blue-60 hover:text-uzh-blue-100">
            Übersicht
          </a>
        </Link>{' '}
        aller Klicker-Elemente Ihrer Kurse an.
      </div>
    ) : ( */}
        <div>
          Sie können sich{' '}
          <Link href="/login">
            <a className="text-uzh-blue-60 hover:text-uzh-blue-100">anmelden</a>
          </Link>
          , um eine Übersicht aller Klicker-Elemente Ihrer Kurse zu sehen.
        </div>
        {/* )} */}
      </div>
    </div>
  )
}

export default MissingPage

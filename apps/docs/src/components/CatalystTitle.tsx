import { faCrown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

function CatalystTitle({ title }: { title: string }) {
  return (
    <div className="-mb-4 flex flex-row flex-wrap items-center justify-between -space-y-4">
      <h1>{title}</h1>
      <a href="/catalyst" className="w-max">
        <div className="h-12 w-full rounded-md bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 p-0.5">
          <div className="flex-flow flex h-full w-full items-center justify-center gap-2 rounded bg-white px-3 py-1 text-black">
            <FontAwesomeIcon icon={faCrown} className="text-orange-400" />
            <div className="hover:text-uzh-blue-100">
              Available for UZH & KlickerUZH Catalyst
            </div>
          </div>
        </div>
      </a>
    </div>
  )
}

export default CatalystTitle

import { faCrown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

function CatalystTitle({ title }: { title: string }) {
  return (
    <div className="flex flex-row flex-wrap items-center justify-between -mb-4 -space-y-4">
      <h1>{title}</h1>
      <a href="/catalyst" className="w-max">
        <div className="w-full p-0.5 rounded-md h-12 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500">
          <div className="flex items-center justify-center w-full h-full gap-2 px-3 py-1 text-black bg-white rounded flex-flow">
            <FontAwesomeIcon icon={faCrown} className="text-orange-400" />
            <div className=" hover:text-uzh-blue-100">
              Available for UZH & KlickerUZH Catalyst
            </div>
          </div>
        </div>
      </a>
    </div>
  )
}

export default CatalystTitle

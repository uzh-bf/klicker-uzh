import { faFlask } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

function PrivatePreviewTag() {
  return (
    <a
      href="/private-preview"
      className="ml-5 inline-block w-max align-middle hover:no-underline"
    >
      <div className="bg-linear-to-r h-auto w-full rounded-md from-purple-500 via-indigo-500 to-blue-500 p-0.5">
        <div className="flex h-full w-full items-center justify-center gap-2 rounded bg-white px-3 py-1 text-xs text-black md:text-sm">
          <FontAwesomeIcon icon={faFlask} className="text-blue-500" />
          <div className="hover:text-uzh-blue-100">Private Preview</div>
        </div>
      </div>
    </a>
  )
}

export default PrivatePreviewTag

import { faPencil, faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FlashcardSetStatus } from '@klicker-uzh/graphql/dist/ops'
import { twMerge } from 'tailwind-merge'

interface StatusTagProps {
  status: string
  type: FlashcardSetStatus
}

function StatusTag({ status, type }: StatusTagProps) {
  return (
    <div
      className={twMerge(
        'px-1 py-0.5 text-sm rounded-md w-max flex flex-row gap-1 items-center',
        type === FlashcardSetStatus.Published && 'bg-green-400',
        type === FlashcardSetStatus.Draft && 'bg-uzh-grey-60'
      )}
    >
      {type === FlashcardSetStatus.Published && (
        <FontAwesomeIcon icon={faUserGroup} className="mr-1" />
      )}
      {type === FlashcardSetStatus.Draft && (
        <FontAwesomeIcon icon={faPencil} className="mr-1" />
      )}
      {status}
    </div>
  )
}

export default StatusTag

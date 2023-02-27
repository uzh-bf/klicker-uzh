import { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { twMerge } from 'tailwind-merge'

interface StatusTagProps {
  color: string
  status: string
  icon: IconDefinition
}

function StatusTag({ color, status, icon }: StatusTagProps) {
  return (
    <div
      className={twMerge(
        'py-0.5 px-1 text-sm rounded bg-red-300 flex flex-row items-center gap-1',
        color
      )}
    >
      <div>{status}</div>
      <FontAwesomeIcon icon={icon} />
    </div>
  )
}

export default StatusTag

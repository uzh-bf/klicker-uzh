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
        'flex flex-row items-center gap-1 rounded bg-red-300 px-1 py-0.5 text-sm',
        color
      )}
    >
      <div>{status}</div>
      <FontAwesomeIcon icon={icon} />
    </div>
  )
}

export default StatusTag

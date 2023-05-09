import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { twMerge } from 'tailwind-merge'

interface TagHeaderProps {
  text: string
  state: boolean
  setState: (state: boolean) => void
}

function TagHeader({ text, state, setState }: TagHeaderProps) {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center justify-between px-4 py-0.5 mb-1 mt-3',
        'font-bold border-b border-solid border-gray-300 text-[1.05rem] text-neutral-500'
      )}
    >
      <div>{text}</div>
      <FontAwesomeIcon
        icon={state ? faChevronUp : faChevronDown}
        onClick={() => setState(!state)}
      />
    </div>
  )
}

export default TagHeader

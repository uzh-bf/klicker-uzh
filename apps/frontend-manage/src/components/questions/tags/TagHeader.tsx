import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface TagHeaderProps {
  text: string
  state: boolean
  setState: (state: boolean) => void
}

function TagHeader({ text, state, setState }: TagHeaderProps) {
  return (
    <Button
      basic
      onClick={() => setState(!state)}
      className={{
        root: twMerge(
          'mb-1 mt-3 flex w-full flex-row items-center justify-between px-2 py-0.5 first:mt-0',
          'border-b border-solid border-gray-300 text-neutral-500'
        ),
      }}
      data={{ cy: `collapse-tag-header-${text}` }}
    >
      <div>{text}</div>
      <FontAwesomeIcon icon={state ? faChevronUp : faChevronDown} />
    </Button>
  )
}

export default TagHeader

import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface SettingHeaderProps {
  text: string
  state: boolean
  setState: (state: boolean) => void
}

function SettingHeader({ text, state, setState }: SettingHeaderProps) {
  return (
    <Button
      basic
      onClick={() => setState(!state)}
      className={{
        root: twMerge(
          'flex flex-row items-center justify-between w-full py-0.5 mb-1 mt-1',
          'font-bold border-b border-solid border-gray-300 text-lg text-neutral-500'
        ),
      }}
    >
      <div>{text}</div>
      <FontAwesomeIcon icon={state ? faChevronUp : faChevronDown} />
    </Button>
  )
}

export default SettingHeader

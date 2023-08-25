import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface SettingHeaderProps {
  title: string
  children?: React.ReactNode
}

function SettingHeader({ title, children }: SettingHeaderProps) {
  const [settingVisible, setSettingVisible] = useState(false)
  return (
    <div className="border-b border-solid border-gray-300">
      <Button
        basic
        onClick={() => setSettingVisible(!settingVisible)}
        className={{
          root: twMerge(
            'flex flex-row items-center justify-between w-full py-0.5 mb-1 mt-1',
            'font-bold  text-lg text-neutral-500'
          ),
        }}
      >
        <div>{title}</div>
        <FontAwesomeIcon icon={settingVisible ? faChevronUp : faChevronDown} />
      </Button>
      {settingVisible && <>{children}</>}
    </div>
  )
}

export default SettingHeader

import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface SettingHeaderProps {
  title: string
  defaultOpen?: boolean
  children?: React.ReactNode
}

function SettingHeader({
  title,
  defaultOpen = true,
  children,
}: SettingHeaderProps) {
  const [settingVisible, setSettingVisible] = useState(defaultOpen)
  return (
    <div className="border-b border-solid border-gray-300">
      <Button
        basic
        onClick={() => setSettingVisible(!settingVisible)}
        className={{
          root: twMerge(
            'mb-1 mt-1 flex w-full flex-row items-center justify-between py-0.5',
            'text-lg font-bold text-neutral-500'
          ),
        }}
        data={{ cy: `collapse-setting-header-${title}` }}
      >
        <div>{title}</div>
        <FontAwesomeIcon icon={settingVisible ? faChevronUp : faChevronDown} />
      </Button>
      {settingVisible && <>{children}</>}
    </div>
  )
}

export default SettingHeader

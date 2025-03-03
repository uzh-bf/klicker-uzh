import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useState } from 'react'

interface SettingProps {
  title: string
  defaultOpen?: boolean
  children?: React.ReactNode
}

function Setting({ title, defaultOpen = true, children }: SettingProps) {
  const [settingVisible, setSettingVisible] = useState(defaultOpen)
  return (
    <div>
      <Button
        basic
        onClick={() => setSettingVisible(!settingVisible)}
        className={{
          root: 'mb-2 mt-1 flex w-full justify-between rounded-none border-b border-gray-300 px-0 py-0.5 text-lg font-bold text-neutral-500 hover:bg-transparent hover:text-neutral-500',
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

export default Setting

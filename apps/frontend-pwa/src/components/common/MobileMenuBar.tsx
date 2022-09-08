import { faHome } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import Router from 'next/router'
import React from 'react'

interface MobileMenuBarProps {
  menuItems?: { icon: React.ReactElement; label: string; value: string }[]
  onClick?: (value: string) => void
}

function MobileMenuBar({
  menuItems,
  onClick,
}: MobileMenuBarProps): React.ReactElement {
  return (
    <div className="flex flex-row justify-between w-full h-full gap-1 bg-uzh-grey-60">
      <Button
        className="flex justify-center flex-1 my-0.5 flex-col gap-0 bg-grey-60 border-0 shadow-none"
        key={'home'}
        onClick={() => Router.push('/')}
      >
        <div>
          <FontAwesomeIcon icon={faHome} size="lg" />
        </div>
        <div className="text-xs">Home</div>
      </Button>
      {onClick &&
        menuItems &&
        menuItems.map((item: any) => (
          <Button
            className="flex justify-center flex-1 my-0.5 flex-col gap-0 bg-grey-60 border-0 shadow-none"
            key={item.value}
            onClick={() => onClick(item.value)}
          >
            <div>{item.icon}</div>
            <div className="text-xs">{item.label}</div>
          </Button>
        ))}
    </div>
  )
}

export default MobileMenuBar

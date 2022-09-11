import { faHome } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, NotificationBadgeWrapper } from '@uzh-bf/design-system'
import Router from 'next/router'
import React from 'react'

interface MobileMenuBarProps {
  menuItems?: {
    icon: React.ReactElement
    label: string
    value: string
    unseenItems?: number
    showBadge?: boolean
  }[]
  onClick?: (value: string) => void
  participantMissing?: boolean
}

function MobileMenuBar({
  menuItems,
  onClick,
  participantMissing,
}: MobileMenuBarProps): React.ReactElement {
  const homeMenuItem = {
    label: 'Home',
    icon: <FontAwesomeIcon icon={faHome} size="lg" />,
    value: 'home',
    onClick: () => Router.push('/'),
  }
  const items = participantMissing ? (menuItems ? menuItems : undefined) : (menuItems ? [homeMenuItem, ...menuItems] : [homeMenuItem])

  return (
    <div className="flex flex-row justify-between w-full h-full gap-1 bg-uzh-grey-60">
      {items && items.map((item: any) => (
        <NotificationBadgeWrapper
          count={item.unseenItems}
          withoutCount={item.showBadge}
          className="flex flex-1"
          key={item.value}
          size="md"
        >
          <Button
            className="flex justify-center flex-1 my-0.5 flex-col gap-0 bg-grey-60 border-0 shadow-none"
            key={item.value}
            onClick={() => {
              if (item.onClick) {
                item.onClick()
              } else if (onClick) {
                onClick(item.value)
              }
            }}
          >
            <div>{item.icon}</div>
            <div className="text-xs">{item.label}</div>
          </Button>
        </NotificationBadgeWrapper>
      ))}
    </div>
  )
}

export default MobileMenuBar

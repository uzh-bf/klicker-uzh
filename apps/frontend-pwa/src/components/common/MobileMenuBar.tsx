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
    data?: {
      cy?: string
      test?: string
    }
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
    data: { cy: 'mobile-menu-home' },
  }
  const items = participantMissing
    ? menuItems
      ? menuItems
      : undefined
    : menuItems
    ? [homeMenuItem, ...menuItems]
    : [homeMenuItem]

  if (!items) {
    return <></>
  }

  return (
    <div className="flex flex-row justify-between w-full gap-1 py-1 text-white bg-slate-800">
      {items.map((item: any) => (
        <NotificationBadgeWrapper
          count={item.unseenItems}
          showBadge={item.showBadge}
          className={{ root: 'flex flex-1' }}
          key={item.value}
          size="sm"
        >
          <Button
            className={{
              root: 'flex justify-center flex-1 flex-col gap-0 bg-grey-60 border-0 shadow-none',
            }}
            key={item.value}
            onClick={() => {
              if (item.onClick) {
                item.onClick()
              } else if (onClick) {
                onClick(item.value)
              }
            }}
            data={item.data}
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

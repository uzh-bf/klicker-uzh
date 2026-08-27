import { faHome } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, NotificationBadgeWrapper } from '@uzh-bf/design-system'
import Router, { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import React from 'react'

interface MobileMenuBarProps {
  menuItems?: {
    icon: React.ReactElement
    label: string
    value: string
    unseenItems?: number
    showBadge?: boolean
    // Items that act on their own instead of switching the mobile page, such as
    // the home shortcut below and the product update feed.
    onClick?: () => void
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
  const t = useTranslations()
  const router = useRouter()
  const homeMenuItem = {
    label: t('shared.generic.home'),
    icon: <FontAwesomeIcon icon={faHome} size="lg" />,
    value: 'home',
    onClick: () => Router.push('/'),
    data: { cy: 'mobile-menu-home' },
  }
  const items = participantMissing
    ? menuItems
    : [...(router.pathname !== '/' ? [homeMenuItem] : []), ...(menuItems ?? [])]

  if (!items) {
    return <></>
  }

  return (
    <div className="flex w-full flex-row justify-between gap-1 border-t-2 bg-slate-50 pb-1">
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
              root: 'flex flex-1 flex-col justify-center border-0 bg-transparent hover:bg-transparent',
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

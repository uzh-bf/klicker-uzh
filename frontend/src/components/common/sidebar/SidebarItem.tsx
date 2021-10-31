import React from 'react'
import { Menu, Icon } from 'semantic-ui-react'
import NotificationBadge from '../NotificationBadge'

interface Props {
  active?: boolean
  children: React.ReactNode
  className?: string
  handleSidebarItemClick: any
  icon?: any
  name: string
  unseenItems?: number
  disabled?: boolean
}

const defaultProps = {
  active: false,
  className: undefined,
  icon: undefined,
  disabled: false,
  unseenItems: 0,
}

function SidebarItem({
  active,
  children,
  className,
  icon,
  name,
  handleSidebarItemClick,
  unseenItems,
  disabled,
}: Props): React.ReactElement {
  return (
    <Menu.Item active={active} className={className} disabled={disabled} name={name} onClick={handleSidebarItemClick}>
      <div className="relative flex flex-row items-center h-5">
        <div className="absolute flex flex-row w-full text-center">
          {icon && (
            <div>
              <Icon name={icon} />
            </div>
          )}
          <div className="ml-4">{children}</div>
        </div>

        {unseenItems > 0 && <NotificationBadge count={unseenItems} />}
      </div>
    </Menu.Item>
  )
}

SidebarItem.defaultProps = defaultProps

export default SidebarItem

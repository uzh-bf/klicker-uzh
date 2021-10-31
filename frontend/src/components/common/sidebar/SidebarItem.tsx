import React from 'react'
import { Menu, Icon } from 'semantic-ui-react'
import NotificationBadge from '../NotificationBadge'

interface Props {
  active?: boolean
  children: React.ReactNode
  className?: string
  handleSidebarItemClick: any
  generic: boolean
  icon?: any
  name: string
  unseenItems?: number
}

const defaultProps = {
  active: false,
  className: undefined,
  icon: undefined,
  generic: true,
}

function SidebarItem({
  active,
  children,
  className,
  icon,
  generic,
  name,
  handleSidebarItemClick,
  unseenItems,
}: Props): React.ReactElement {
  return (
    <Menu.Item active={active} className={className} name={name} onClick={handleSidebarItemClick}>
      {generic && icon && <Icon name={icon} />}
      {generic && children}
      {!generic && (
        <div className="relative flex flex-row items-center h-5">
          <div className="absolute flex flex-row w-full text-center">
            {icon && (
              <div>
                <Icon name={icon} />
              </div>
            )}
            <div className="ml-4">{children}</div>
          </div>

          {unseenItems !== 0 && <NotificationBadge count={unseenItems} />}
        </div>
      )}
    </Menu.Item>
  )
}

SidebarItem.defaultProps = defaultProps

export default SidebarItem

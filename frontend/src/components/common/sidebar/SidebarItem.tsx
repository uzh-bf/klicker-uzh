import React from 'react'
import { Menu, Icon } from 'semantic-ui-react'

interface Props {
  active?: boolean
  children: React.ReactNode
  className?: string
  handleSidebarItemClick: any
  icon?: any
  name: string
  unseenItems: number
}

const defaultProps = {
  active: false,
  className: undefined,
  icon: undefined,
}

function SidebarItem({
  active,
  children,
  className,
  icon,
  name,
  handleSidebarItemClick,
  unseenItems,
}: Props): React.ReactElement {
  return (
    <Menu.Item active={active} className={className} name={name} onClick={handleSidebarItemClick}>
      <div className="relative h-5">
        <div className="absolute w-full text-center">
          {icon && <Icon name={icon} />}
          {children}
        </div>

        {unseenItems < 10 && unseenItems > 0 && (
          <div className="w-5 h-5 ml-auto text-sm text-center text-white align-middle bg-red-600 right-2 rounded-xl">
            {unseenItems}
          </div>
        )}
        {unseenItems > 9 && (
          <div className="ml-auto w-5 pt-[0.2rem] h-5 text-[0.8rem] text-center text-white align-middle bg-red-600 right-2 rounded-xl">
            9+
          </div>
        )}
      </div>
    </Menu.Item>
  )
}

SidebarItem.defaultProps = defaultProps

export default SidebarItem

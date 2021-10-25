import React from 'react'
import { Menu, Icon } from 'semantic-ui-react'

interface Props {
  active?: boolean
  children: React.ReactNode
  className?: string
  handleSidebarItemClick: any
  icon?: any
  name: string
}

const defaultProps = {
  active: false,
  className: undefined,
  icon: undefined,
}

// TODO: replace by real count of unread items
const count = 5

function SidebarItem({ active, children, className, icon, name, handleSidebarItemClick }: Props): React.ReactElement {
  return (
    <Menu.Item active={active} className={className} name={name} onClick={handleSidebarItemClick}>
      {icon && <Icon name={icon} />}
      {children}

      {count < 10 && (
        <div className="inline-block float-right w-5 h-5 text-sm text-center text-white align-middle bg-red-600 right-2 rounded-xl">
          {count}
        </div>
      )}
      {count > 9 && (
        <div className="inline-block float-right w-5 pt-[0.2rem] h-5 text-[0.8rem] text-center text-white align-middle bg-red-600 right-2 rounded-xl">
          9+
        </div>
      )}
    </Menu.Item>
  )
}

SidebarItem.defaultProps = defaultProps

export default SidebarItem

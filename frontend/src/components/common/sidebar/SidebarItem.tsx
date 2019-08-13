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

function SidebarItem({ active, children, className, icon, name, handleSidebarItemClick }: Props): React.ReactElement {
  return (
    <Menu.Item active={active} className={className} name={name} onClick={handleSidebarItemClick}>
      {icon && <Icon name={icon} />}
      {children}
    </Menu.Item>
  )
}

SidebarItem.defaultProps = defaultProps

export default SidebarItem

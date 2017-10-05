import React from 'react'
import { Menu } from 'semantic-ui-react'

const defaultProps = {
  active: false,
}

const SidebarItem = ({ active, children, href, name, handleSidebarItemClick }) => (
  <Menu.Item active={active} name={name} onClick={handleSidebarItemClick(href)}>
    {children}
  </Menu.Item>
)

SidebarItem.defaultProps = defaultProps

export default SidebarItem

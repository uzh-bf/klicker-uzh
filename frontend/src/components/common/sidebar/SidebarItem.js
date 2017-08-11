// @flow

import React from 'react'
import { Menu } from 'semantic-ui-react'

type Props = {
  active: boolean,
  children: any,
  href: string,
  name: string,
  handleSidebarItemClick: (href: string) => () => mixed,
}

const defaultProps = {
  active: false,
}

const SidebarItem = ({ active, children, href, name, handleSidebarItemClick }: Props) =>
  (<Menu.Item active={active} name={name} onClick={handleSidebarItemClick(href)}>
    {children}
  </Menu.Item>)

SidebarItem.defaultProps = defaultProps

export default SidebarItem

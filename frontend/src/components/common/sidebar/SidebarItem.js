// @flow

import React from 'react'
import Router from 'next/router'
import { Menu } from 'semantic-ui-react'

type Props = {
  active: boolean,
  children: any,
  href: string,
  name: string,
}

const defaultProps = {
  active: false,
}

const SidebarItem = ({ active, children, href, name }: Props) =>
  (<Menu.Item active={active} name={name} onClick={() => Router.push(href)}>
    {children}
  </Menu.Item>)

SidebarItem.defaultProps = defaultProps

export default SidebarItem
